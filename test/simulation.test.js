const assert = require("assert");
const {
  TrafficSimulation,
  ROUTES,
  HIGHWAY_ROUTES,
  ROAD_MODEL,
  ROAD_CONDITIONS,
  STOP_LINES,
  MAX_STEP_SECONDS,
  INCIDENT_MIN_DURATION_SECONDS,
  INCIDENT_MAX_DURATION_SECONDS,
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

function vehicleApproachingIncident(sim, distance, speed) {
  const incident = sim.activeIncident;
  const routes = sim.config.mode === "highway" ? HIGHWAY_ROUTES : ROUTES;
  const route = Object.assign({}, routes[incident.direction]);
  const lane = incident.lane;
  return {
    id: 9001,
    direction: incident.direction,
    route,
    position: incident.position - route.sign * distance,
    progress: 0,
    speed,
    currentSpeed: speed,
    length: 45,
    width: 20,
    massKg: 1550,
    lane,
    targetLane: lane,
    laneOffset: ROAD_MODEL.laneOffsets[sim.config.mode][incident.direction][lane],
    baseLaneOffset: ROAD_MODEL.laneOffsets[sim.config.mode][incident.direction][lane],
    laneTargetOffset: ROAD_MODEL.laneOffsets[sim.config.mode][incident.direction][lane],
    laneChangeCooldown: 0,
    driver: { type: "normal", reactionScale: 1, headwayScale: 1, accelerationScale: 1, brakingScale: 1 },
    braking: false,
    brakeDelayRemaining: 0,
    brakeTargetSpeed: speed,
    crashed: false,
    waiting: false
  };
}

function incidentTriggerVehicle(id, direction, lane, position, currentSpeed, waiting) {
  return {
    id,
    direction,
    route: Object.assign({}, ROUTES[direction]),
    lane,
    targetLane: lane,
    position,
    currentSpeed,
    waiting: Boolean(waiting),
    crashed: false,
    laneChanging: false
  };
}

function redLightRunnerVehicle(id, direction, lane, position, risk) {
  const route = Object.assign({}, ROUTES[direction]);
  return {
    id,
    direction,
    headingDirection: direction,
    route,
    lane,
    targetLane: lane,
    position,
    previousPosition: position,
    progress: Math.abs(position - route.start),
    x: route.axis === "x" ? position : route.fixed,
    y: route.axis === "y" ? position : route.fixed,
    laneOffset: 0,
    speed: 12,
    currentSpeed: 0,
    length: 45,
    width: 20,
    waiting: true,
    braking: false,
    brakeDelayRemaining: 0,
    brakeTargetSpeed: 0,
    crashed: false,
    isBus: false,
    isEmergency: false,
    redLightRisk: risk,
    redLightViolationUntil: 0,
    driver: { type: "assertive", reactionScale: 0.86 }
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

runTest("random incident timing is reproducible for the same seed", () => {
  const first = new TrafficSimulation({ config: { incident: true, seed: "incident-demo" } });
  const second = new TrafficSimulation({ config: { incident: true, seed: "incident-demo" } });
  assert.strictEqual(first.nextIncidentAt, second.nextIncidentAt);
  assert(first.nextIncidentAt >= 5 * 60 && first.nextIncidentAt <= 15 * 60);
});

runTest("changing incident frequency immediately reschedules a pending incident", () => {
  const sim = new TrafficSimulation({
    config: { incident: true, incidentFrequency: "normal", seed: "frequency-change" }
  });
  const originalIncidentAt = sim.nextIncidentAt;
  sim.time = 30;

  sim.setConfig({ incidentFrequency: "high" });

  const remainingSeconds = sim.nextIncidentAt - sim.time;
  assert.notStrictEqual(sim.nextIncidentAt, originalIncidentAt);
  assert(remainingSeconds >= 2 * 60 && remainingSeconds <= 5 * 60);
});

runTest("changing incident frequency does not alter an active incident", () => {
  const sim = new TrafficSimulation({
    config: { incident: true, incidentFrequency: "normal", seed: "active-frequency-change" }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const clearsAt = sim.activeIncident.clearsAt;

  sim.setConfig({ incidentFrequency: "high" });

  assert.strictEqual(sim.activeIncident.clearsAt, clearsAt);
  assert.strictEqual(sim.nextIncidentAt, null);
});

runTest("random incidents last 30 to 120 simulated minutes and clear automatically", () => {
  const sim = new TrafficSimulation({ config: { incident: true, seed: "incident-duration" } });
  sim.time = 5;
  sim.lastSignal = { ew: "green", ns: "red" };
  sim.vehicles = [incidentTriggerVehicle(101, "east", 0, 300, 10, false)];
  sim.nextIncidentAt = sim.time;
  sim.updateIncidentState();
  assert(sim.activeIncident, "scheduled incident should activate");
  assert.strictEqual(sim.activeIncident.triggerVehicleId, 101);
  assert(sim.activeIncident.durationSeconds >= INCIDENT_MIN_DURATION_SECONDS);
  assert(sim.activeIncident.durationSeconds <= INCIDENT_MAX_DURATION_SECONDS);
  sim.time = sim.activeIncident.clearsAt;
  sim.updateIncidentState();
  assert.strictEqual(sim.activeIncident, null, "incident should clear at the scheduled handling time");
  assert(sim.nextIncidentAt > sim.time, "a cleared incident should schedule a future event");
});

runTest("intersection incidents use moving traffic from the green approach", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, signalCycle: 40, greenSplit: 50 }
  });
  sim.time = 25;
  sim.lastSignal = { ew: "red", ns: "green" };
  sim.vehicles = [
    incidentTriggerVehicle(201, "east", 0, 300, 0, true),
    incidentTriggerVehicle(202, "south", 1, 180, 9, false)
  ];
  sim.nextIncidentAt = sim.time;

  sim.updateIncidentState();

  assert(sim.activeIncident);
  assert.strictEqual(sim.activeIncident.direction, "south");
  assert.strictEqual(sim.activeIncident.lane, 1);
  assert.strictEqual(sim.activeIncident.position, 250);
  assert.strictEqual(sim.activeIncident.triggerVehicleId, 202);
});

runTest("scheduled incidents wait when only red-light or stopped traffic is available", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, signalCycle: 40, greenSplit: 50 }
  });
  sim.time = 25;
  sim.lastSignal = { ew: "red", ns: "green" };
  sim.vehicles = [
    incidentTriggerVehicle(301, "east", 0, 300, 10, false),
    incidentTriggerVehicle(302, "south", 1, 180, 0, true)
  ];
  sim.nextIncidentAt = sim.time;

  sim.updateIncidentState();

  assert.strictEqual(sim.activeIncident, null);
  assert.strictEqual(sim.nextIncidentAt, sim.time + 1);
  assert.strictEqual(sim.incidentCount, 0);
});

runTest("disabled random incidents remain inactive", () => {
  const sim = new TrafficSimulation({ config: { incident: false, seed: "no-incidents" } });
  sim.time = 24 * 60 * 60;
  sim.updateIncidentState();
  assert.strictEqual(sim.activeIncident, null);
  assert.strictEqual(sim.nextIncidentAt, null);
});

runTest("invalid incident durations fall back to a finite random handling time", () => {
  const sim = new TrafficSimulation({ config: { incident: true, seed: "invalid-duration" } });
  const incident = sim.activateIncident("not-a-duration");
  assert(Number.isFinite(incident.durationSeconds));
  assert(incident.durationSeconds >= INCIDENT_MIN_DURATION_SECONDS);
  assert(incident.durationSeconds <= INCIDENT_MAX_DURATION_SECONDS);
});

runTest("signal alternates between east-west and north-south", () => {
  const config = { signalCycle: 40, greenSplit: 50, busPriority: false };
  assert.strictEqual(signalState(5, config, null).ew, "green");
  assert.strictEqual(signalState(25, config, null).ew, "red");
  assert.strictEqual(signalState(25, config, null).ns, "green");
});

runTest("signal changes can trigger a reproducible red-light violation", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { signalCycle: 40, greenSplit: 50, busPriority: false, redLightRunning: true }
  });
  const vehicle = redLightRunnerVehicle(401, "east", 0, STOP_LINES.east - 35, 1);
  sim.time = 22;
  sim.lastSignal = { ew: "red", ns: "red" };
  sim.lastGreenSignal = "ew";
  sim.vehicles = [vehicle];

  const signal = sim.refreshSignal(null);

  assert.strictEqual(signal.ns, "green");
  assert(vehicle.redLightViolationUntil > sim.time);
  assert.strictEqual(vehicle.waiting, false);
  assert.strictEqual(sim.eventLog.at(-1).type, "red-light-run");
  assert.strictEqual(sim.eventLog.at(-1).details.conflictingGreenSignal, "ns");
  const target = sim.computeTargetSpeed(vehicle, null);
  assert.strictEqual(target.speed, vehicle.speed, "active violator should not brake for its red signal");
  const previousPosition = vehicle.position;
  vehicle.position = STOP_LINES.east + 5;
  sim.enforceRedLightBoundary(vehicle, previousPosition);
  assert.strictEqual(vehicle.position, STOP_LINES.east + 5, "active violator should cross the stop line");
});

runTest("active red-light violators do not extend the legal all-red clearance", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { signalCycle: 40, greenSplit: 50, busPriority: false, redLightRunning: true }
  });
  const vehicle = redLightRunnerVehicle(402, "east", 0, 560, 1);
  vehicle.x = 560;
  vehicle.y = 330;
  vehicle.redLightViolationUntil = 30;
  sim.time = 25;
  sim.lastGreenSignal = "ns";
  sim.vehicles = [vehicle];

  const signal = sim.refreshSignal(null);

  assert.strictEqual(signal.ew, "red");
  assert.strictEqual(signal.ns, "green");
});

runTest("disabled red-light violations keep risky drivers stopped", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { signalCycle: 40, greenSplit: 50, busPriority: false, redLightRunning: false }
  });
  const vehicle = redLightRunnerVehicle(403, "east", 0, STOP_LINES.east - 35, 1);
  sim.time = 22;
  sim.lastSignal = { ew: "red", ns: "red" };
  sim.lastGreenSignal = "ew";
  sim.vehicles = [vehicle];

  sim.refreshSignal(null);

  assert.strictEqual(vehicle.redLightViolationUntil, 0);
  assert.strictEqual(sim.eventLog.some((event) => event.type === "red-light-run"), false);
});

runTest("seeded red-light violations can collide with conflicting green traffic", () => {
  const sim = new TrafficSimulation({
    config: {
      seed: "red-run-2",
      demand: 70,
      incident: false,
      busPriority: false,
      redLightRunning: true
    }
  });
  while (sim.time < 90) sim.step(0.08);
  const violation = sim.eventLog.find((event) => event.type === "red-light-run");
  assert(violation, "expected the seeded scenario to produce a red-light violation");
  const relatedCollision = sim.eventLog.find((event) => (
    event.type === "collision" &&
    event.time >= violation.time &&
    event.details.vehicleIds.includes(violation.details.vehicleId)
  ));
  assert(relatedCollision, "expected the violating vehicle to collide with conflicting traffic");
  assert(relatedCollision.details.impactSpeedKmh > 0);
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
  sim.setConfig({ incident: 1, busPriority: 0, redLightRunning: 1 });
  assert.strictEqual(sim.config.incident, true);
  assert.strictEqual(sim.config.busPriority, false);
  assert.strictEqual(sim.config.redLightRunning, true);
});

runTest("setConfig validates road condition", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  assert.strictEqual(ROAD_CONDITIONS.icy.brakingScale < ROAD_CONDITIONS.dry.brakingScale, true);
  sim.setConfig({ roadCondition: "icy" });
  assert.strictEqual(sim.config.roadCondition, "icy");
  sim.setConfig({ roadCondition: "unknown" });
  assert.strictEqual(sim.config.roadCondition, "dry");
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

runTest("collided vehicles conserve momentum before settling", () => {
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
  assert(first.currentSpeed > 0 || second.currentSpeed > 0, "impact momentum should not disappear instantly");
  sim.settleCrashedVehicle(first, 3);
  sim.settleCrashedVehicle(second, 3);
  assert.strictEqual(first.currentSpeed, 0);
  assert.strictEqual(second.currentSpeed, 0);
  assert.strictEqual(sim.getMetrics().collisionVehicles, 2);
  assert(sim.getMetrics().collisionSeverityKmh > 0, "collision should record relative impact speed");
});

runTest("legal stop-line queues do not collide with cross traffic at lane corners", () => {
  const sim = new TrafficSimulation({
    config: { incident: false, redLightRunning: false, seed: "demo-traffic" }
  });
  while (sim.time < 45) sim.step(0.08);
  assert.strictEqual(
    sim.eventLog.some((event) => event.type === "collision"),
    false,
    "signal-compliant traffic should not produce corner-overlap collisions"
  );
});

runTest("cross-traffic contact outside the intersection is not a collision", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom() });
  const stoppedSouthbound = {
    id: 1,
    direction: "south",
    headingDirection: "south",
    route: Object.assign({}, ROUTES.south),
    position: 257.5,
    previousPosition: 257.5,
    progress: 337.5,
    x: 546.1,
    y: 257.5,
    previousX: 546.1,
    previousY: 257.5,
    currentSpeed: 0,
    length: 45,
    width: 20,
    lane: 1,
    crashed: false
  };
  const passingEastbound = {
    id: 2,
    direction: "east",
    headingDirection: "east",
    route: Object.assign({}, ROUTES.east),
    position: 514.6,
    previousPosition: 505,
    progress: 594.6,
    x: 514.6,
    y: 288.5,
    previousX: 505,
    previousY: 288.5,
    currentSpeed: 12.19,
    length: 45,
    width: 20,
    lane: 1,
    crashed: false
  };
  sim.vehicles = [stoppedSouthbound, passingEastbound];
  sim.detectCollisions();
  assert.strictEqual(stoppedSouthbound.crashed, false);
  assert.strictEqual(passingEastbound.crashed, false);
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

runTest("icy road reduces available braking compared with dry road", () => {
  function setup(roadCondition) {
    const sim = new TrafficSimulation({
      random: deterministicRandom(),
      config: { roadCondition, speedLimit: 80, reactionTime: 1.2 }
    });
    sim.lastSignal = signalState(25, { signalCycle: 40, greenSplit: 50, busPriority: false }, null);
    const vehicle = {
      direction: "east",
      route: Object.assign({}, ROUTES.east),
      position: 400,
      progress: 480,
      x: 400,
      y: 330,
      previousX: 400,
      previousY: 330,
      speed: 20,
      currentSpeed: 20,
      length: 22,
      lane: 0,
      targetLane: 0,
      laneOffset: 0,
      laneTargetOffset: 0,
      laneChanging: false,
      braking: false,
      brakeDelayRemaining: 0,
      brakeTargetSpeed: 20,
      crashed: false,
      waiting: false
    };
    sim.vehicles = [vehicle];
    return { sim, vehicle };
  }

  const dry = setup("dry");
  const icy = setup("icy");
  dry.sim.moveVehicles(0.08);
  icy.sim.moveVehicles(0.08);
  assert(dry.vehicle.currentSpeed < icy.vehicle.currentSpeed, "dry road should allow stronger deceleration than icy road");
  assert(icy.vehicle.waiting, "icy-road vehicle should still identify the red light as a stop condition");
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

runTest("incident caps speed in its selected direction and lane", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, speedLimit: 60 }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  sim.lastSignal = Object.assign(signalState(5, { signalCycle: 40, greenSplit: 50, busPriority: false }, null), { ns: "green" });
  const vehicle = vehicleApproachingIncident(sim, 1, 3);
  const result = sim.computeTargetSpeed(vehicle, null);
  assert(result.speed < vehicle.speed, "speed must be capped inside incident zone");
  assert(result.waiting, "vehicle inside incident zone must be marked waiting");
});

runTest("incident traffic keeps moving through cooperative lane changes under heavy demand", () => {
  const base = new TrafficSimulation({
    random: deterministicRandom(),
    config: { demand: 95, speedLimit: 55, incident: false }
  });
  const incident = new TrafficSimulation({
    random: deterministicRandom(),
    config: { demand: 95, speedLimit: 55, incident: true, incidentSeverity: "major" }
  });
  incident.activateIncident(INCIDENT_MIN_DURATION_SECONDS);

  for (let i = 0; i < 1800; i += 1) {
    base.step(0.08);
    incident.step(0.08);
  }

  const baseMetrics = base.getMetrics();
  const incidentMetrics = incident.getMetrics();
  const incidentLaneChanges = incident.eventLog.filter((event) => (
    event.type === "lane-change-start" && event.details.reason === "incident"
  ));
  const completedLaneChangeIds = new Set(incident.eventLog
    .filter((event) => event.type === "lane-change-complete")
    .map((event) => event.details.vehicleId));
  assert(
    incidentLaneChanges.length > 0,
    "expected blocked-lane traffic to begin changing lanes"
  );
  assert(
    incidentLaneChanges.some((event) => completedLaneChangeIds.has(event.details.vehicleId)),
    "expected at least one incident lane change to complete"
  );
  assert(
    incidentMetrics.completedTrips > 0,
    "expected traffic to continue passing the incident"
  );
  assert(
    incidentMetrics.collisionVehicles <= baseMetrics.collisionVehicles,
    "expected incident scenario not to increase collisions"
  );
});

runTest("incident does not slow traffic on another approach", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, speedLimit: 60 }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const otherDirection = ["east", "west", "south", "north"].find((direction) => direction !== sim.activeIncident.direction);
  const vehicle = {
    direction: otherDirection,
    route: Object.assign({}, ROUTES[otherDirection]),
    position: 760,
    length: 22,
    speed: 60 / 3.6,
    waiting: false
  };
  const target = sim.computeTargetSpeed(vehicle, null);
  assert.strictEqual(target.speed, vehicle.speed);
});

runTest("intersection incident makes approaching vehicles brake before the blockage", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, speedLimit: 50 }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const vehicle = vehicleApproachingIncident(sim, 70, 14);
  const result = sim.computeTargetSpeed(vehicle, null);
  assert.strictEqual(result.speed, 0);
  assert(result.waiting, "blocked vehicle should be marked waiting");
});

runTest("intersection incident traffic changes lanes instead of remaining blocked", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, incidentSeverity: "major", speedLimit: 50 }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const route = ROUTES[sim.activeIncident.direction];
  sim.activeIncident.position = route.start + (route.end - route.start) * 0.3;
  const vehicle = vehicleApproachingIncident(sim, 80, 12);
  vehicle.laneChangeCooldown = 8;
  sim.vehicles = [vehicle];

  for (let index = 0; index < 30 && !vehicle.laneChanging; index += 1) {
    sim.evaluateLaneChange(vehicle, sim.vehicles, 0.1);
  }

  assert(vehicle.laneChanging, "incident avoidance must override the normal lane-change cooldown");
  const targetLane = sim.incidentTargetLane(sim.activeIncident);
  assert.strictEqual(vehicle.targetLane, targetLane);
  sim.advanceLaneChange(vehicle, vehicle.laneChange.duration + 0.1);
  assert.strictEqual(vehicle.lane, targetLane);
  assert.strictEqual(sim.incidentForVehicle(vehicle), null);
});

runTest("queued intersection traffic recognizes an incident before reaching the queue front", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { incident: true, incidentSeverity: "major", speedLimit: 50 }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const route = ROUTES[sim.activeIncident.direction];
  sim.activeIncident.position = route.start + (route.end - route.start) * 0.3;
  const queuedVehicle = vehicleApproachingIncident(sim, 400, 0);
  sim.vehicles = [queuedVehicle];

  for (let index = 0; index < 30 && !queuedVehicle.laneChanging; index += 1) {
    sim.evaluateLaneChange(queuedVehicle, sim.vehicles, 0.1);
  }

  assert(queuedVehicle.laneChanging, "queued vehicle should begin avoiding the incident before reaching the queue front");
  assert.strictEqual(queuedVehicle.laneChange.reason, "incident");
});

runTest("open-lane traffic yields early to an incident merge requester", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true, incidentSeverity: "major" }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const requester = vehicleApproachingIncident(sim, 100, 10);
  const targetLane = sim.incidentTargetLane(sim.activeIncident);
  requester.laneChangeIntent = { targetLane, reason: "incident", decisionRemaining: 0.5 };
  const yieldingVehicle = Object.assign({}, requester, {
    id: requester.id + 1,
    position: requester.position - requester.route.sign * 230,
    lane: targetLane,
    targetLane,
    laneChangeIntent: null,
    speed: 6,
    currentSpeed: 6
  });
  sim.vehicles = [requester, yieldingVehicle];

  const target = sim.computeTargetSpeed(yieldingVehicle, null);
  assert(target.speed < yieldingVehicle.speed, "rear vehicle in the open lane should create a merge gap");
});

runTest("open-lane traffic yields to the nearest safe incident merge requester", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true, incidentSeverity: "major" }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const farRequester = vehicleApproachingIncident(sim, 100, 0);
  const targetLane = sim.incidentTargetLane(sim.activeIncident);
  farRequester.laneChangeIntent = { targetLane, reason: "incident", decisionRemaining: 0 };
  const yieldingVehicle = Object.assign({}, farRequester, {
    id: farRequester.id + 2,
    position: farRequester.position - farRequester.route.sign * 400,
    lane: targetLane,
    targetLane,
    laneChangeIntent: null,
    speed: 6,
    currentSpeed: 6
  });
  const nearRequester = Object.assign({}, farRequester, {
    id: farRequester.id + 1,
    position: yieldingVehicle.position + farRequester.route.sign * 230,
    speed: 3,
    currentSpeed: 3
  });
  sim.vehicles = [farRequester, nearRequester, yieldingVehicle];

  const target = sim.computeTargetSpeed(yieldingVehicle, null);
  assert(target.speed > 0, "nearest requester should take priority over a farther stopped requester");
  assert(target.speed < yieldingVehicle.speed, "open-lane vehicle should still slow to create the merge gap");
});

runTest("open-lane traffic passes when it is too close to yield safely", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true, incidentSeverity: "major" }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const requester = vehicleApproachingIncident(sim, 100, 0);
  const targetLane = sim.incidentTargetLane(sim.activeIncident);
  requester.laneChangeIntent = { targetLane, reason: "incident", decisionRemaining: 0 };
  const passingVehicle = Object.assign({}, requester, {
    id: requester.id + 1,
    position: requester.position - requester.route.sign * 45,
    lane: targetLane,
    targetLane,
    laneChangeIntent: null,
    speed: 16,
    currentSpeed: 16
  });
  sim.vehicles = [requester, passingVehicle];

  const target = sim.computeTargetSpeed(passingVehicle, null);
  assert.strictEqual(target.speed, passingVehicle.speed, "a close vehicle should pass instead of stopping beside the merge requester");
});

runTest("intersection incidents are generated upstream of the stop line", () => {
  for (const seed of ["incident-a", "incident-b", "incident-c", "incident-d"]) {
    const sim = new TrafficSimulation({ config: { incident: true, seed } });
    sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
    const incident = sim.activeIncident;
    const route = ROUTES[incident.direction];
    const inConflictArea = route.axis === "x"
      ? incident.position >= ROAD_MODEL.bounds.intersection.left && incident.position <= ROAD_MODEL.bounds.intersection.right
      : incident.position >= ROAD_MODEL.bounds.intersection.top && incident.position <= ROAD_MODEL.bounds.intersection.bottom;
    assert.strictEqual(inConflictArea, false, `${seed} placed an incident inside the intersection`);
    const distanceToStopLine = (STOP_LINES[incident.direction] - incident.position) * route.sign;
    assert(distanceToStopLine > 0, `${seed} placed an incident downstream of the stop line`);
  }
});

runTest("intersection incident seeds produce visible avoidance lane changes", () => {
  for (const seed of ["intersection-1", "intersection-2", "intersection-9", "intersection-16"]) {
    const sim = new TrafficSimulation({
      config: { mode: "intersection", seed, demand: 70, incident: true, incidentSeverity: "major" }
    });
    sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
    for (let index = 0; index < 1800; index += 1) sim.step(0.08);
    const laneChangeStarted = sim.eventLog.some((event) => (
      event.type === "lane-change-start" && event.details.reason === "incident"
    ));
    assert(laneChangeStarted, `${seed} did not produce an incident avoidance lane change`);
  }
});

runTest("intersection incident keeps its detour lane clear of existing crashes", () => {
  const sim = new TrafficSimulation({
    config: { mode: "intersection", seed: "blocked-detour", incident: true, incidentSeverity: "major" }
  });
  sim.vehicles = Object.keys(ROUTES).map((direction, index) => ({
    id: index + 1,
    direction,
    lane: 1,
    crashed: true
  }));

  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);

  assert.strictEqual(sim.activeIncident.lane, 1, "incident lane should leave lane 0 available as the detour");
  assert.strictEqual(sim.incidentTargetLane(sim.activeIncident), 0);
});

runTest("delayed default intersection incident starts from moving green traffic", () => {
  const sim = new TrafficSimulation({
    config: {
      mode: "intersection",
      seed: "demo-traffic",
      demand: 52,
      incident: true,
      incidentFrequency: "normal",
      incidentSeverity: "mixed"
    }
  });
  while (!sim.activeIncident && sim.time < 900) sim.step(0.08);
  assert(sim.activeIncident, "default scenario did not generate an incident");
  const route = ROUTES[sim.activeIncident.direction];
  assert.strictEqual(sim.lastSignal[route.signal], "green");
  assert.notStrictEqual(sim.activeIncident.triggerVehicleId, null);
  const trigger = sim.vehicles.find((vehicle) => vehicle.id === sim.activeIncident.triggerVehicleId);
  assert(trigger, "incident trigger vehicle should still be present when the incident starts");
  assert(trigger.currentSpeed > 0, "incident trigger vehicle should be moving");
});

runTest("highway incident triggers a human decision delay before changing lanes", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true, reactionTime: 1, brakeBuildTime: 0.5 }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const vehicle = vehicleApproachingIncident(sim, 90, 14);
  sim.vehicles = [vehicle];
  sim.evaluateLaneChange(vehicle, sim.vehicles, 0.1);
  assert(vehicle.laneChangeIntent, "driver should first form an intent to avoid the incident");
  assert.strictEqual(vehicle.laneChanging, undefined, "lane change must not begin before the decision delay");
  for (let index = 0; index < 30 && !vehicle.laneChanging; index += 1) {
    sim.evaluateLaneChange(vehicle, sim.vehicles, 0.1);
  }
  const result = sim.computeTargetSpeed(vehicle, null);
  assert.strictEqual(vehicle.lane, sim.activeIncident.lane);
  assert.strictEqual(vehicle.targetLane, sim.activeIncident.lane === 0 ? 1 : 0);
  assert(vehicle.laneChanging, "lane change should remain active until the lateral move finishes");
  assert(result.speed < vehicle.speed, "vehicle should slow while changing away from the incident");
  assert(result.speed <= vehicle.speed * 0.72, "vehicle should use a cautious maneuver speed");
});

runTest("lane change waits when a faster rear vehicle is too close", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", reactionTime: 1.2, brakeBuildTime: 0.5 }
  });
  const vehicle = {
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 650,
    speed: 18,
    currentSpeed: 14,
    length: 22,
    lane: 0,
    targetLane: 0,
    driver: { reactionScale: 1 }
  };
  const fastRearVehicle = {
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 620,
    speed: 25,
    currentSpeed: 25,
    length: 22,
    lane: 1,
    targetLane: 1
  };
  assert.strictEqual(sim.canChangeLane(vehicle, 1, [vehicle, fastRearVehicle]), false);
});

runTest("a driver overtakes a substantially slower leader after observing the target lane", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom(), config: { mode: "highway" } });
  const vehicle = {
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 500,
    speed: 18,
    currentSpeed: 18,
    length: 22,
    lane: 0,
    targetLane: 0,
    laneOffset: 0,
    laneTargetOffset: 0,
    laneChangeCooldown: 0,
    driver: { type: "normal", reactionScale: 1 }
  };
  const slowLeader = {
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 610,
    speed: 9,
    currentSpeed: 8,
    length: 22,
    lane: 0,
    targetLane: 0
  };
  const vehicles = [vehicle, slowLeader];
  sim.evaluateLaneChange(vehicle, vehicles, 0.1);
  assert.strictEqual(vehicle.laneChangeIntent.reason, "overtake");
  for (let index = 0; index < 30 && !vehicle.laneChanging; index += 1) {
    sim.evaluateLaneChange(vehicle, vehicles, 0.1);
  }
  assert(vehicle.laneChanging, "driver should change lanes once observation and gap checks pass");
});

runTest("lane changes follow a smooth multi-second lateral path", () => {
  const sim = new TrafficSimulation({ random: deterministicRandom(), config: { mode: "highway" } });
  const vehicle = {
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    lane: 0,
    targetLane: 0,
    laneOffset: 0,
    laneTargetOffset: 0,
    laneJitter: 0,
    driver: { type: "normal" },
    laneChangeIntent: { targetLane: 1, reason: "overtake" }
  };
  sim.startLaneChange(vehicle, 1);
  const duration = vehicle.laneChange.duration;
  assert(duration >= 2.2 && duration <= 4.2);
  sim.advanceLaneChange(vehicle, duration / 4);
  assert(vehicle.laneOffset < 0 && vehicle.laneOffset > -18, "vehicle should ease into the target lane");
  sim.advanceLaneChange(vehicle, duration);
  assert.strictEqual(vehicle.lane, 1);
  assert.strictEqual(vehicle.laneOffset, -36);
  assert.strictEqual(vehicle.laneChanging, false);
});

runTest("vehicle changing lanes occupies the source and target lane for safety checks", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
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
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const vehicle = vehicleApproachingIncident(sim, 80, 14);
  const targetLane = sim.activeIncident.lane === 0 ? 1 : 0;
  const adjacent = {
    direction: vehicle.direction,
    route: vehicle.route,
    lane: targetLane,
    targetLane,
    position: vehicle.position + vehicle.route.sign * 25,
    currentSpeed: 14,
    length: 45
  };
  sim.vehicles = [vehicle, adjacent];
  const result = sim.computeTargetSpeed(vehicle, null);
  assert(result.speed < vehicle.speed, "vehicle should brake while waiting for a safe adjacent-lane gap");
});

runTest("highway incident prevents blocked vehicles from crossing the incident", () => {
  const sim = new TrafficSimulation({
    random: deterministicRandom(),
    config: { mode: "highway", incident: true, reactionTime: 0, brakeBuildTime: 0 }
  });
  sim.activateIncident(INCIDENT_MIN_DURATION_SECONDS);
  const vehicle = vehicleApproachingIncident(sim, 28, 14);
  vehicle.progress = Math.abs(vehicle.position - vehicle.route.start);
  const targetLane = sim.activeIncident.lane === 0 ? 1 : 0;
  const adjacent = {
    direction: vehicle.direction,
    route: vehicle.route,
    position: vehicle.position + vehicle.route.sign * 20,
    progress: vehicle.progress + 20,
    lane: targetLane,
    targetLane,
    currentSpeed: 0,
    length: 45,
    crashed: true
  };
  sim.vehicles = [vehicle, adjacent];
  sim.moveVehicles(0.08);
  const stopPosition = sim.activeIncident.position - vehicle.route.sign * (sim.activeIncident.length / 2 + vehicle.length / 2 + 10);
  assert((vehicle.position - stopPosition) * vehicle.route.sign <= 0, "blocked vehicle must stop before the incident marker");
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
  assert.strictEqual(scenario.schemaVersion, 4);
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
    "incident",
    "metrics",
    "vehicles",
    "events",
    "history",
    "state"
  ]);
  assert(scenario.vehicles.length > 0, "expected exported vehicles");
  assert.deepStrictEqual(Object.keys(scenario.vehicles[0]), [
    "id",
    "direction",
    "lane",
    "targetLane",
    "laneChanging",
    "laneChangeReason",
    "position",
    "currentSpeed",
    "driverType",
    "waiting",
    "braking",
    "crashed",
    "collisionSpeedKmh",
    "crashClearAt"
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
  assert(follower.currentSpeed > 0, "rear-end momentum should decay instead of disappearing instantly");
  assert.strictEqual(sim.getMetrics().collisionVehicles, 2);
  assert(leader.crashClearAt >= INCIDENT_MIN_DURATION_SECONDS);
  assert(leader.crashClearAt <= INCIDENT_MAX_DURATION_SECONDS);
  sim.time = leader.crashClearAt;
  sim.removeResolvedCrashes();
  assert.strictEqual(sim.vehicles.length, 0, "collision vehicles should be removed after response handling completes");
  assert.strictEqual(sim.getMetrics().resolvedCrashVehicles, 2);
});

runTest("lane closures use the same physical blockage and avoidance model as incidents", () => {
  const sim = new TrafficSimulation({ config: { mode: "highway", laneClosure: true, incident: false } });
  const closure = sim.configuredLaneClosure();
  assert(closure && closure.permanent);
  assert.strictEqual(sim.getSnapshot().incidents.length, 1);
  const route = Object.assign({}, HIGHWAY_ROUTES[closure.direction]);
  const vehicle = {
    id: 10,
    direction: closure.direction,
    route,
    position: closure.position - route.sign * 80,
    speed: 15,
    currentSpeed: 15,
    length: 45,
    lane: closure.lane,
    targetLane: closure.lane,
    laneChangeCooldown: 0,
    driver: { type: "normal", reactionScale: 1, headwayScale: 1 },
    waiting: false
  };
  sim.vehicles = [vehicle];
  sim.evaluateLaneChange(vehicle, sim.vehicles, 0.1);
  assert.strictEqual(vehicle.laneChangeIntent.reason, "incident");
  assert(sim.computeTargetSpeed(vehicle, null).speed < vehicle.speed);
});

runTest("ramp traffic starts outside the mainline and merges when a gap is available", () => {
  const sim = new TrafficSimulation({ config: { mode: "highway", rampMerge: true, incident: false } });
  for (const key of Object.keys(sim.spawnTimers)) sim.spawnTimers[key] = 99;
  sim.spawnTimers["ramp:east"] = 0;
  sim.spawnVehicles(0, 2);
  const rampVehicle = sim.vehicles.find((vehicle) => vehicle.origin === "ramp");
  assert(rampVehicle, "expected a vehicle at the ramp entrance");
  assert.strictEqual(rampVehicle.lane, 2);
  rampVehicle.position = 440;
  sim.evaluateRampMerge(rampVehicle, [rampVehicle]);
  assert.strictEqual(rampVehicle.lane, 0);
  assert.strictEqual(rampVehicle.rampMerge.complete, true);
});

runTest("pedestrian phase creates an all-red interval", () => {
  const config = { signalCycle: 40, greenSplit: 50, busPriority: false, pedestrianPhase: true };
  const signal = signalState(37, config, null);
  assert.strictEqual(signal.ew, "red");
  assert.strictEqual(signal.ns, "red");
  assert.strictEqual(signal.pedestrian, true);
});

runTest("unsafe lane changes abort before crossing the lane boundary", () => {
  const sim = new TrafficSimulation({ config: { mode: "highway", incident: false } });
  const vehicle = {
    id: 1,
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 500,
    speed: 18,
    currentSpeed: 18,
    length: 45,
    lane: 0,
    targetLane: 0,
    laneOffset: 0,
    laneTargetOffset: 0,
    laneJitter: 0,
    driver: { type: "normal", reactionScale: 1 },
    laneChangeIntent: { targetLane: 1, reason: "overtake" }
  };
  sim.startLaneChange(vehicle, 1);
  const fastRear = {
    id: 2,
    direction: "east",
    route: Object.assign({}, HIGHWAY_ROUTES.east),
    position: 470,
    currentSpeed: 28,
    speed: 28,
    length: 45,
    lane: 1,
    targetLane: 1
  };
  sim.reassessLaneChange(vehicle, [vehicle, fastRear]);
  assert.strictEqual(vehicle.laneChange.aborting, true);
  assert.strictEqual(vehicle.targetLane, 0);
});

runTest("serialized state restores exact deterministic continuation", () => {
  const first = new TrafficSimulation({ config: { mode: "highway", demand: 80, incident: true, seed: "restore-demo" } });
  for (let index = 0; index < 140; index += 1) first.step(0.08);
  const restored = new TrafficSimulation();
  restored.restoreScenario(first.serializeScenario());
  for (let index = 0; index < 80; index += 1) {
    first.step(0.08);
    restored.step(0.08);
  }
  assert.deepStrictEqual(restored.serializeScenario(), first.serializeScenario());
});

runTest("CSV export contains reproducible time-series metrics", () => {
  const sim = new TrafficSimulation({ config: { seed: "csv-demo" } });
  sim.step(0.08);
  const csv = sim.exportMetricsCsv();
  assert(csv.startsWith("time,averageSpeedKmh,vehicleCount,queueLength,completedTrips,collisionVehicles\n"));
  assert(csv.split("\n").length >= 2);
});

runTest("turning vehicles use their current heading for collision geometry", () => {
  const sim = new TrafficSimulation({ config: { turningTraffic: true } });
  const turningBus = {
    id: 1,
    direction: "east",
    headingDirection: "north",
    route: Object.assign({}, ROUTES.east),
    position: 560,
    previousPosition: 558,
    progress: 640,
    x: 560,
    y: 360,
    previousX: 560,
    previousY: 362,
    currentSpeed: 8,
    length: 110,
    width: 20,
    massKg: 12500,
    lane: 0,
    targetLane: 0,
    crashed: false
  };
  const northboundCar = {
    id: 2,
    direction: "north",
    headingDirection: "north",
    route: Object.assign({}, ROUTES.north),
    position: 400,
    previousPosition: 402,
    progress: 400,
    x: 560,
    y: 400,
    previousX: 560,
    previousY: 402,
    currentSpeed: 8,
    length: 45,
    width: 20,
    massKg: 1550,
    lane: 0,
    targetLane: 0,
    crashed: false
  };
  sim.vehicles = [turningBus, northboundCar];
  sim.detectCollisions();
  assert(turningBus.crashed && northboundCar.crashed);
});

runTest("scenario import rejects unsupported future schemas", () => {
  const sim = new TrafficSimulation();
  assert.throws(() => sim.restoreScenario({ schemaVersion: 99, config: {} }), /Unsupported/);
});

if (failures.length > 0) {
  console.error(`${failures.length} test failure(s)`);
  process.exit(1);
}
