const assert = require("assert");
const {
  TrafficSimulation,
  ROUTES,
  HIGHWAY_ROUTES,
  ROAD_MODEL,
  STOP_LINES,
  MAX_STEP_SECONDS,
  signalState,
  clamp,
  normalizeSeed
} = require("../src/simulation");

function deterministicRandom() {
  let seed = 12345;
  return function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const failures = [];

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.stack);
    failures.push(error);
  }
}

runTest("clamp constrains values", () => {
  assert.strictEqual(clamp(12, 0, 10), 10);
  assert.strictEqual(clamp(-2, 0, 10), 0);
  assert.strictEqual(clamp(7, 0, 10), 7);
});

runTest("normalizeSeed trims, preserves zero, and clamps length", () => {
  assert.strictEqual(normalizeSeed("  demo  "), "demo");
  assert.strictEqual(normalizeSeed(0), "0");
  assert.strictEqual(normalizeSeed("x".repeat(80)).length, 64);
  assert.strictEqual(normalizeSeed(""), "demo-traffic");
});

runTest("signal alternates between east-west and north-south", () => {
  const config = { signalCycle: 40, greenSplit: 50, busPriority: false };
  assert.strictEqual(signalState(5, config, null).ew, "green");
  assert.strictEqual(signalState(25, config, null).ew, "red");
  assert.strictEqual(signalState(25, config, null).ns, "green");
});

runTest("bus priority can extend either signal phase", () => {
  const config = { signalCycle: 40, greenSplit: 50, busPriority: true };
  assert.strictEqual(signalState(23, config, "ew").ew, "green");
  assert.strictEqual(signalState(16, config, "ns").ew, "red");
  assert.strictEqual(signalState(16, config, "ns").ns, "green");
});

runTest("road model is the single source for route and layout alignment", () => {
  assert.strictEqual(ROAD_MODEL.routes.intersection.east, ROUTES.east);
  assert.strictEqual(ROAD_MODEL.routes.highway.east, HIGHWAY_ROUTES.east);
  assert.deepStrictEqual(ROAD_MODEL.layout.intersection, [492, 292, 138, 138]);
  assert.strictEqual(ROAD_MODEL.bounds.incident.startX, 742);
  assert.strictEqual(ROAD_MODEL.stopLines.east, STOP_LINES.east);
});

runTest("disabled bus priority leaves base timing unchanged", () => {
  const config = { signalCycle: 40, greenSplit: 50, busPriority: false };
  assert.strictEqual(signalState(23, config, "ew").ew, "red");
  assert.strictEqual(signalState(16, config, "ns").ew, "green");
});

runTest("signal holds all-red while the opposing approach is still in the intersection", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { signalCycle: 40, greenSplit: 50, busPriority: false }
  });
  sim.time = 25;
  sim.vehicles = [{
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    x: 560,
    y: 330,
    position: 560,
    lane: 0
  }];
  assert.deepStrictEqual(sim.refreshSignal(null), { ew: "red", ns: "red" });
});

runTest("crashed vehicles do not permanently lock the signal cycle", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { signalCycle: 40, greenSplit: 50, busPriority: false }
  });
  sim.time = 25;
  sim.vehicles = [{
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    x: 560,
    y: 330,
    crashed: true
  }];
  const signal = sim.refreshSignal(null);
  assert.strictEqual(signal.ew, "red");
  assert.strictEqual(signal.ns, "green");
});

runTest("step applies bus priority for an approaching bus", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { signalCycle: 40, greenSplit: 50, busPriority: true }
  });
  sim.time = 23;
  // Intentional white-box setup: place a valid bus object inside the detector zone.
  sim.vehicles = [{
    id: 1,
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    isBus: true,
    position: STOP_LINES.east - 20,
    progress: 0,
    laneOffset: 0,
    speedRatio: 0.9,
    speed: 12,
    currentSpeed: 0,
    length: 34,
    waiting: false
  }];
  sim.step(0);
  assert.strictEqual(sim.lastSignal.ew, "green");
});

runTest("findPriorityBus chooses the closest approaching bus", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { busPriority: true }
  });
  // Minimal stubs: findPriorityBus only reads isBus, direction, route.sign, and position.
  const eastBus = {
    id: 1,
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    isBus: true,
    position: STOP_LINES.east - 100,
    speed: 12,
    currentSpeed: 0,
    length: 34
  };
  const northBus = {
    id: 2,
    direction: "north",
    route: Object.assign({}, ROUTES.north),
    isBus: true,
    position: STOP_LINES.north + 20,
    speed: 12,
    currentSpeed: 0,
    length: 34
  };
  sim.vehicles = [eastBus, northBus];
  assert.strictEqual(sim.findPriorityBus(), northBus);
});

runTest("getPrioritySignal returns null when no bus qualifies", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { busPriority: true }
  });
  assert.strictEqual(sim.getPrioritySignal(), null);
});

runTest("step ignores approaching buses when priority is disabled", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { signalCycle: 40, greenSplit: 50, busPriority: false }
  });
  sim.time = 23;
  sim.vehicles = [{
    id: 1,
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    isBus: true,
    position: STOP_LINES.east - 20,
    progress: 0,
    laneOffset: 0,
    speedRatio: 0.9,
    speed: 12,
    currentSpeed: 0,
    length: 34,
    waiting: false
  }];
  sim.step(0);
  assert.strictEqual(sim.lastSignal.ew, "red");
});

runTest("setConfig preserves per-vehicle speed ratios", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { demand: 95, speedLimit: 60 }
  });
  for (let i = 0; i < 40; i += 1) {
    sim.step(0.08);
  }
  assert(sim.vehicles.length > 0, "expected vehicles to exist before config change");
  const before = sim.vehicles.map((vehicle) => vehicle.speedRatio);
  sim.setConfig({ speedLimit: 30 });
  assert.deepStrictEqual(sim.vehicles.map((vehicle) => vehicle.speedRatio), before);
  for (const vehicle of sim.vehicles) {
    assert.strictEqual(vehicle.speed, (30 / 3.6) * vehicle.speedRatio);
  }
});

runTest("setConfig with the same seed does not restart the random stream", () => {
  const sim = new TrafficSimulation({ config: { seed: "stable-stream" } });
  sim.random();
  sim.setConfig({ seed: "stable-stream", demand: 60 });
  const continuedValue = sim.random();
  const comparison = new TrafficSimulation({ config: { seed: "stable-stream" } });
  comparison.random();
  assert.strictEqual(continuedValue, comparison.random());
});

runTest("setConfig mode changes restart the seeded random stream", () => {
  const sim = new TrafficSimulation({ config: { seed: "mode-stream" } });
  sim.random();
  sim.setConfig({ mode: "highway" });
  const restartedValue = sim.random();
  const comparison = new TrafficSimulation({ config: { seed: "mode-stream", mode: "highway" } });
  assert.strictEqual(restartedValue, comparison.random());
});

runTest("reset merges partial config with defaults", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  sim.reset({ demand: 80 });
  assert.strictEqual(sim.config.demand, 80);
  assert.strictEqual(sim.config.speedLimit, 50);
  assert.strictEqual(sim.config.busPriority, true);
});

runTest("setConfig handles empty updates", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  sim.setConfig();
  assert.strictEqual(sim.config.demand, 52);
});

runTest("setConfig clamps zero speed limit", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  sim.setConfig({ speedLimit: 0 });
  assert.strictEqual(sim.config.speedLimit, 1);
});

runTest("setConfig coerces boolean controls", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  sim.setConfig({ incident: 1, busPriority: 0 });
  assert.strictEqual(sim.config.incident, true);
  assert.strictEqual(sim.config.busPriority, false);
});

runTest("canSpawn blocks vehicles that are too close to the entry", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  assert.strictEqual(sim.canSpawn("east"), true);
  // Minimal stub: canSpawn only needs direction and position.
  sim.vehicles.push({ direction: "east", position: ROUTES.east.start });
  assert.strictEqual(sim.canSpawn("east"), false);
  assert.strictEqual(sim.canSpawn("west"), true);
});

runTest("snapshots do not expose shared route constants", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { demand: 95 }
  });
  for (let i = 0; i < 40; i += 1) {
    sim.step(0.08);
  }
  const snapshot = sim.getSnapshot();
  assert(snapshot.vehicles.length > 0, "expected vehicles in snapshot");
  snapshot.vehicles[0].route.axis = "broken";
  assert.notStrictEqual(sim.vehicles[0].route.axis, "broken");
});

runTest("simulation spawns and completes traffic", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { demand: 90, speedLimit: 70, signalCycle: 26 }
  });

  for (let i = 0; i < 900; i += 1) {
    sim.step(0.08);
  }

  const metrics = sim.getMetrics();
  assert(metrics.vehicleCount > 0, "expected active vehicles");
  assert(metrics.completedTrips > 0, "expected completed trips");
  assert(metrics.averageSpeedKmh >= 0, "expected non-negative average speed");
});

runTest("removeCompleted removes exited vehicles and increments trips", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  sim.step(0);
  assert(sim.vehicles.length > 0, "expected a spawned vehicle");
  const vehicle = sim.vehicles[0];
  vehicle.position = vehicle.route.sign > 0 ? vehicle.route.end + 1 : vehicle.route.end - 1;
  sim.removeCompleted();
  assert.strictEqual(sim.vehicles.includes(vehicle), false);
  assert.strictEqual(sim.completedTrips, 1);
});

runTest("step clamps large deltas", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  sim.step(5);
  assert.strictEqual(sim.time, MAX_STEP_SECONDS);
});

runTest("highway mode uses opposing east-west traffic without signals", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", demand: 90 }
  });
  for (let i = 0; i < 40; i += 1) {
    sim.step(0.08);
  }
  assert(sim.vehicles.length > 0, "expected highway vehicles");
  assert(sim.vehicles.every((vehicle) => vehicle.direction === "east" || vehicle.direction === "west"));
  assert(sim.vehicles.every((vehicle) => vehicle.lane === 0 || vehicle.lane === 1));
  assert.strictEqual(new Set(sim.vehicles.map((vehicle) => vehicle.lane)).size, 2, "expected both highway lanes to receive traffic");
  assert.deepStrictEqual(sim.lastSignal, { ew: "green", ns: "green" });
});

runTest("setConfig safely switches modes with active vehicles", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom(), config: { demand: 90 } });
  for (let i = 0; i < 20; i += 1) {
    sim.step(0.08);
  }
  sim.setConfig({ mode: "highway" });
  assert.strictEqual(sim.vehicles.length, 0);
  assert.doesNotThrow(() => sim.step(0.08));
  assert(sim.vehicles.every((vehicle) => vehicle.direction === "east" || vehicle.direction === "west"));
});

runTest("highway braking delay keeps speed during reaction and brake build-up", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", reactionTime: 1, brakeBuildTime: 0.5 }
  });
  const vehicle = {
    direction: "east",
    route: { axis: "x", sign: 1, signal: null },
    currentSpeed: 20,
    speed: 20,
    braking: false,
    brakeDelayRemaining: 0,
    brakeTargetSpeed: 20
  };
  const delayedTarget = sim.applyBrakeDelay(vehicle, 0, 0.08);
  assert.strictEqual(delayedTarget, 20);
  assert.strictEqual(vehicle.braking, true);
  for (let i = 0; i < 20; i += 1) {
    vehicle.currentSpeed = sim.applyBrakeDelay(vehicle, 0, 0.08);
  }
  assert(vehicle.braking, "braking episode should remain active after the delay expires");
  sim.applyBrakeDelay(vehicle, vehicle.speed, 0.08);
  assert.strictEqual(vehicle.braking, false);
});

runTest("highway braking target can recover to an intermediate speed", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", reactionTime: 0, brakeBuildTime: 0 }
  });
  const vehicle = {
    currentSpeed: 20,
    speed: 20,
    braking: false,
    brakeDelayRemaining: 0,
    brakeTargetSpeed: 20
  };
  vehicle.currentSpeed = sim.applyBrakeDelay(vehicle, 5, 0.08);
  const recoveredTarget = sim.applyBrakeDelay(vehicle, 12, 0.08);
  assert.strictEqual(recoveredTarget, 12);
});

runTest("getMetrics calculates average speed and queue length", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  // Intentional minimal stubs: this isolates getMetrics from movement and spawn behavior.
  sim.vehicles = [
    { currentSpeed: 10, waiting: false },
    { currentSpeed: 20, waiting: true, braking: true }
  ];
  const metrics = sim.getMetrics();
  // avg m/s = (10 + 20) / 2 = 15; km/h = 15 * 3.6 = 54.
  assert.strictEqual(metrics.averageSpeedKmh, 54);
  assert.strictEqual(metrics.queueLength, 1);
  assert.strictEqual(metrics.brakingVehicles, 1);
});

runTest("getMetrics handles empty simulations", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  const metrics = sim.getMetrics();
  assert.strictEqual(metrics.averageSpeedKmh, 0);
  assert.strictEqual(metrics.vehicleCount, 0);
  assert.strictEqual(metrics.queueLength, 0);
  assert.strictEqual(metrics.brakingVehicles, 0);
  assert.strictEqual(metrics.collisionVehicles, 0);
  assert.strictEqual(metrics.collisionSeverityKmh, 0);
});

runTest("collided vehicles stop and remain in the network", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  const first = {
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    x: 560,
    y: 330,
    currentSpeed: 10,
    length: 22,
    crashed: false,
    waiting: false
  };
  const second = {
    direction: "north",
    route: Object.assign({}, ROUTES.north),
    x: 565,
    y: 335,
    currentSpeed: 10,
    length: 22,
    crashed: false,
    waiting: false
  };
  sim.vehicles = [first, second];
  sim.detectCollisions();
  assert(first.crashed && second.crashed, "overlapping vehicles must be marked crashed");
  assert.strictEqual(first.currentSpeed, 0);
  assert.strictEqual(second.currentSpeed, 0);
  assert.strictEqual(sim.getMetrics().collisionVehicles, 2);
  assert(sim.getMetrics().collisionSeverityKmh > 0, "collision should record relative impact speed");
});

runTest("following model brakes before a high closing-speed collision", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", reactionTime: 1.2, brakeBuildTime: 0.5 }
  });
  const leader = {
    direction: "east",
    lane: 0,
    route: { axis: "x", sign: 1, signal: null },
    position: 500,
    speed: 4,
    currentSpeed: 4,
    length: 22
  };
  const follower = {
    direction: "east",
    lane: 0,
    route: { axis: "x", sign: 1, signal: null },
    position: 390,
    speed: 20,
    currentSpeed: 20,
    length: 22
  };
  const result = sim.computeTargetSpeed(follower, leader);
  assert(result.speed < follower.currentSpeed, "closing vehicle must brake before contact");
});

runTest("vehicle past stop line is not re-stopped by red light", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  sim.lastSignal = signalState(25, { signalCycle: 40, greenSplit: 50, busPriority: false }, null);
  const vehicle = {
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    position: STOP_LINES.east + 5,
    speed: 10,
    currentSpeed: 10,
    length: 22,
    waiting: false
  };
  const result = sim.computeTargetSpeed(vehicle, null);
  assert.strictEqual(result.speed, vehicle.speed, "vehicle past stop line must travel at full speed");
});

runTest("follower brakes when too close to leader", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  // Force both signals green to isolate follower braking from signal behavior.
  sim.lastSignal = Object.assign(signalState(5, { signalCycle: 40, greenSplit: 50, busPriority: false }, null), { ns: "green" });
  const leader = {
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    position: 300,
    speed: 10,
    currentSpeed: 10,
    length: 22,
    waiting: false
  };
  const follower = {
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    position: 260,
    speed: 10,
    currentSpeed: 10,
    length: 22,
    waiting: false
  };
  const result = sim.computeTargetSpeed(follower, leader);
  assert(result.speed < follower.speed, "follower must brake when gap is too small");
});

runTest("incident caps speed of eastbound vehicle inside the zone", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, speedLimit: 60 }
  });
  sim.lastSignal = Object.assign(signalState(5, { signalCycle: 40, greenSplit: 50, busPriority: false }, null), { ns: "green" });
  const vehicle = {
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    position: 760,
    speed: 3,
    currentSpeed: 3,
    length: 22,
    waiting: false
  };
  const result = sim.computeTargetSpeed(vehicle, null);
  assert(result.speed < vehicle.speed, "speed must be capped inside incident zone");
  assert(result.waiting, "vehicle inside incident zone must be marked waiting");
});

runTest("incident reduces throughput conditions under heavy demand", () => {
  const base = new TrafficSimulation({
    random: deterministicRandom(),
    config: { demand: 95, speedLimit: 55, incident: false }
  });
  const incident = new TrafficSimulation({
    random: deterministicRandom(),
    config: { demand: 95, speedLimit: 55, incident: true }
  });

  for (let i = 0; i < 700; i += 1) {
    base.step(0.08);
    incident.step(0.08);
  }

  const baseMetrics = base.getMetrics();
  const incidentMetrics = incident.getMetrics();
  assert(
    incidentMetrics.completedTrips < baseMetrics.completedTrips,
    "expected incident scenario to reduce throughput"
  );
  assert(
    incidentMetrics.collisionVehicles <= baseMetrics.collisionVehicles,
    "expected incident scenario not to increase collisions"
  );
});

runTest("incident does not slow non-eastbound vehicles", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, speedLimit: 60 }
  });
  const vehicle = {
    direction: "west",
    route: { axis: "x", sign: -1, signal: "ew" },
    position: 760,
    length: 22,
    speed: 60 / 3.6,
    waiting: false
  };
  const target = sim.computeTargetSpeed(vehicle, null);
  assert.strictEqual(target.speed, vehicle.speed);
});

runTest("intersection incident makes eastbound vehicles brake before the blockage", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, speedLimit: 50 }
  });
  const vehicle = {
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    position: 650,
    speed: 14,
    currentSpeed: 14,
    length: 22,
    lane: 0,
    waiting: false
  };
  const result = sim.computeTargetSpeed(vehicle, null);
  assert.strictEqual(result.speed, 0);
  assert(result.waiting, "blocked vehicle should be marked waiting");
});

runTest("highway incident changes to an open adjacent lane", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true, reactionTime: 1, brakeBuildTime: 0.5 }
  });
  const vehicle = {
    direction: "east",
    route: { axis: "x", sign: 1, signal: null },
    position: 650,
    speed: 14,
    currentSpeed: 14,
    length: 22,
    lane: 0,
    baseLaneOffset: 0,
    laneTargetOffset: 0,
    waiting: false
  };
  sim.vehicles = [vehicle];
  const result = sim.computeTargetSpeed(vehicle, null);
  assert.strictEqual(vehicle.lane, 0);
  assert.strictEqual(vehicle.targetLane, 1);
  assert(vehicle.laneChanging, "lane change should remain active until the lateral move finishes");
  assert(result.speed < vehicle.speed, "vehicle should slow while changing away from the incident");
  assert(result.waiting, "vehicle should remain cautious while the lane change is in progress");
});

runTest("vehicle changing lanes occupies the source and target lane for safety checks", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true }
  });
  const changing = {
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 650,
    speed: 14,
    currentSpeed: 14,
    length: 22,
    lane: 0,
    targetLane: 1,
    laneChanging: true,
    laneChange: { sourceLane: 0, targetLane: 1 },
    laneOffset: 0,
    laneTargetOffset: -36,
    waiting: false
  };
  const follower = {
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 620,
    speed: 14,
    currentSpeed: 14,
    length: 22,
    lane: 0,
    targetLane: 0,
    laneOffset: 0,
    laneTargetOffset: 0,
    waiting: false
  };
  sim.vehicles = [changing, follower];
  const result = sim.computeTargetSpeed(follower, changing);
  assert(result.speed < follower.speed, "follower must treat a lane-changing vehicle as still occupying the source lane");
  assert.strictEqual(sim.canChangeIncidentLane(follower), false, "target lane should be blocked by the active lane change");
});

runTest("highway incident makes vehicles brake when the adjacent lane is occupied", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true }
  });
  const vehicle = {
    direction: "east",
    route: { axis: "x", sign: 1, signal: null },
    position: 650,
    speed: 14,
    currentSpeed: 14,
    length: 22,
    lane: 0,
    baseLaneOffset: 0,
    laneTargetOffset: 0,
    waiting: false
  };
  const adjacent = { direction: "east", lane: 1, position: 680 };
  sim.vehicles = [vehicle, adjacent];
  const result = sim.computeTargetSpeed(vehicle, null);
  assert.strictEqual(result.speed, 0);
  assert(result.waiting, "vehicle should queue when no adjacent lane is available");
});

runTest("highway incident prevents blocked vehicles from crossing the incident", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true, reactionTime: 0, brakeBuildTime: 0 }
  });
  const vehicle = {
    direction: "east",
    route: { axis: "x", sign: 1, signal: null, start: -80, end: 1200 },
    position: 710,
    progress: 790,
    speed: 14,
    currentSpeed: 14,
    length: 22,
    lane: 0,
    laneOffset: 0,
    baseLaneOffset: 0,
    laneTargetOffset: 0,
    waiting: false,
    crashed: false
  };
  const adjacent = {
    direction: "east",
    route: vehicle.route,
    position: 710,
    progress: 790,
    lane: 1,
    crashed: true
  };
  sim.vehicles = [vehicle, adjacent];
  sim.moveVehicles(0.08);
  assert(vehicle.position <= 715, "blocked vehicle must stop before the incident marker");
  assert.strictEqual(vehicle.currentSpeed, 0);
  assert(vehicle.waiting, "blocked vehicle should remain waiting");
});

runTest("same seed reproduces the same scenario state", () => {
  const first = new TrafficSimulation({ config: { mode: "highway", demand: 80, seed: "morning-demo" } });
  const second = new TrafficSimulation({ config: { mode: "highway", demand: 80, seed: "morning-demo" } });
  for (let i = 0; i < 120; i += 1) {
    first.step(0.08);
    second.step(0.08);
  }
  assert.deepStrictEqual(first.serializeScenario(), second.serializeScenario());
});

runTest("different seeds produce different spawned traffic", () => {
  const first = new TrafficSimulation({ config: { mode: "highway", demand: 80, seed: "alpha" } });
  const second = new TrafficSimulation({ config: { mode: "highway", demand: 80, seed: "beta" } });
  for (let i = 0; i < 80; i += 1) {
    first.step(0.08);
    second.step(0.08);
  }
  assert.notDeepStrictEqual(first.serializeScenario().vehicles, second.serializeScenario().vehicles);
});

runTest("scenario export includes reproducibility metadata and metrics", () => {
  const sim = new TrafficSimulation({ config: { seed: "export-demo", demand: 70 } });
  sim.step(0.08);
  const scenario = sim.serializeScenario();
  assert.strictEqual(scenario.schemaVersion, 1);
  assert.strictEqual(scenario.roadModelVersion, ROAD_MODEL.version);
  assert.strictEqual(scenario.seed, "export-demo");
  assert.strictEqual(scenario.config.seed, "export-demo");
  assert.strictEqual(typeof scenario.metrics.vehicleCount, "number");
  assert(Array.isArray(scenario.vehicles));
});

runTest("scenario export schema keeps stable top-level and vehicle keys", () => {
  const sim = new TrafficSimulation({ config: { mode: "highway", demand: 95, seed: "schema-demo" } });
  for (let i = 0; i < 40; i += 1) {
    sim.step(0.08);
  }
  const scenario = sim.serializeScenario();
  assert.deepStrictEqual(Object.keys(scenario), [
    "schemaVersion",
    "roadModelVersion",
    "seed",
    "config",
    "time",
    "metrics",
    "vehicles"
  ]);
  assert(scenario.vehicles.length > 0, "expected exported vehicles");
  assert.deepStrictEqual(Object.keys(scenario.vehicles[0]), [
    "id",
    "direction",
    "lane",
    "targetLane",
    "laneChanging",
    "position",
    "currentSpeed",
    "waiting",
    "braking",
    "crashed",
    "collisionSpeedKmh"
  ]);
});

runTest("lane-change swept checks do not crash before lateral contact", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom(), config: { mode: "highway" } });
  const leader = {
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 500,
    previousPosition: 500,
    progress: 580,
    x: 500,
    y: 270,
    previousX: 500,
    previousY: 270,
    currentSpeed: 10,
    length: 22,
    lane: 1,
    targetLane: 1,
    crashed: false,
    waiting: false
  };
  const changing = {
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 501,
    previousPosition: 470,
    progress: 581,
    x: 501,
    y: 306,
    previousX: 470,
    previousY: 306,
    currentSpeed: 10.1,
    length: 22,
    lane: 0,
    targetLane: 1,
    laneChanging: true,
    laneChange: { sourceLane: 0, targetLane: 1 },
    laneOffset: 0,
    laneTargetOffset: -36,
    crashed: false,
    waiting: false
  };
  sim.vehicles = [leader, changing];
  sim.detectCollisions();
  assert.strictEqual(leader.crashed, false);
  assert.strictEqual(changing.crashed, false);
});

runTest("step records rear-end impact into a crashed leader", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", demand: 10, speedLimit: 80, reactionTime: 0, brakeBuildTime: 0 }
  });
  const leader = {
    id: 1,
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 500,
    previousPosition: 500,
    progress: 580,
    x: 500,
    y: 306,
    previousX: 500,
    previousY: 306,
    currentSpeed: 0,
    speed: 0,
    speedRatio: 0,
    length: 22,
    lane: 0,
    targetLane: 0,
    laneOffset: 0,
    laneTargetOffset: 0,
    laneChanging: false,
    crashed: true,
    collisionSpeedKmh: 0,
    waiting: true
  };
  const follower = {
    id: 2,
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 455,
    previousPosition: 455,
    progress: 535,
    x: 455,
    y: 306,
    previousX: 455,
    previousY: 306,
    currentSpeed: 18,
    speed: 18,
    speedRatio: 0.9,
    length: 22,
    lane: 0,
    targetLane: 0,
    laneOffset: 0,
    laneTargetOffset: 0,
    laneChanging: false,
    braking: false,
    brakeDelayRemaining: 0,
    brakeTargetSpeed: 18,
    crashed: false,
    collisionSpeedKmh: 0,
    waiting: false
  };
  sim.vehicles = [leader, follower];
  sim.spawnTimers = { "east:0": 99, "east:1": 99, "west:0": 99, "west:1": 99 };
  sim.step(0.08);
  assert(follower.crashed, "fast follower should crash into the stopped obstacle");
  assert(sim.getMetrics().collisionVehicles >= 2);
});

runTest("same-lane rear-end collisions are recorded instead of ignored", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  const leader = {
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    position: 500,
    previousPosition: 500,
    progress: 580,
    x: 500,
    y: 330,
    previousX: 500,
    previousY: 330,
    currentSpeed: 0,
    length: 22,
    lane: 0,
    targetLane: 0,
    crashed: false,
    waiting: false
  };
  const follower = {
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    position: 498,
    previousPosition: 460,
    progress: 578,
    x: 498,
    y: 330,
    previousX: 460,
    previousY: 330,
    currentSpeed: 12,
    length: 22,
    lane: 0,
    targetLane: 0,
    crashed: false,
    waiting: false
  };
  sim.vehicles = [leader, follower];
  sim.detectCollisions();
  assert(leader.crashed && follower.crashed, "rear-end overlap must be counted as a collision");
  assert.strictEqual(follower.currentSpeed, 0);
  assert.strictEqual(sim.getMetrics().collisionVehicles, 2);
});

if (failures.length > 0) {
  console.error(`${failures.length} test failure(s)`);
  process.exit(1);
}
