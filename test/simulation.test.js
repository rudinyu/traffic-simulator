const assert = require("assert");
const {
  TrafficSimulation,
  ROUTES,
  STOP_LINES,
  MAX_STEP_SECONDS,
  signalState,
  clamp
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

runTest("disabled bus priority leaves base timing unchanged", () => {
  const config = { signalCycle: 40, greenSplit: 50, busPriority: false };
  assert.strictEqual(signalState(23, config, "ew").ew, "red");
  assert.strictEqual(signalState(16, config, "ns").ew, "green");
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
    direction: "east",
    route: Object.assign({}, ROUTES.east),
    x: 565,
    y: 330,
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
    incidentMetrics.averageSpeedKmh < baseMetrics.averageSpeedKmh,
    "expected incident scenario to lower average speed"
  );
  assert(
    incidentMetrics.completedTrips <= baseMetrics.completedTrips,
    "expected incident scenario to avoid increasing throughput"
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
  assert.strictEqual(vehicle.lane, 1);
  assert.strictEqual(result.speed, vehicle.speed);
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

if (failures.length > 0) {
  console.error(`${failures.length} test failure(s)`);
  process.exit(1);
}
