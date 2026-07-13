(function initTrafficSimulation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TrafficSimulatorLib = {
      TrafficSimulation: api.TrafficSimulation
    };
  }
})(globalThis, function factory() {
  "use strict";

  const DIRECTIONS = ["east", "west", "south", "north"];
  // Coordinates align with src/app.js canvas layout. fixed is the lane center:
  // horizontal lanes use app layout horizontalRoadY 276 plus offsets 54/114;
  // vertical lanes use app layout verticalRoadX 476 plus offsets 49/119.
  const ROUTES = {
    east: { axis: "x", start: -80, end: 1200, fixed: 330, sign: 1, signal: "ew" },
    west: { axis: "x", start: 1200, end: -80, fixed: 390, sign: -1, signal: "ew" },
    south: { axis: "y", start: -80, end: 800, fixed: 525, sign: 1, signal: "ns" },
    north: { axis: "y", start: 800, end: -80, fixed: 595, sign: -1, signal: "ns" }
  };

  const HIGHWAY_ROUTES = {
    east: { axis: "x", start: -80, end: 1200, fixed: 306, sign: 1, signal: null },
    west: { axis: "x", start: 1200, end: -80, fixed: 390, sign: -1, signal: null }
  };

  const STOP_LINES = {
    // Stop lines frame the central intersection drawn in app layout [492, 292, 138, 138].
    east: 492,
    west: 630,
    south: 292,
    north: 430
  };

  const DEFAULT_CONFIG = Object.freeze({
    mode: "intersection",
    demand: 52,
    speedLimit: 50,
    signalCycle: 42,
    greenSplit: 52,
    incident: false,
    busPriority: true,
    reactionTime: 1.2,
    brakeBuildTime: 0.5
  });
  const PX_PER_METER = 18;
  const LANE_JITTER_PX = 12;
  const MAX_STEP_SECONDS = 0.08;
  const BUS_SPAWN_PROBABILITY = 0.08;
  const SPAWN_RETRY_SECONDS = 0.1;
  const BUS_PRIORITY_DETECTION_PX = 145;
  const MIN_SPAWN_GAP_PX = 55;
  const INCIDENT_START_X = 742; // Matches the visual incident marker left edge in src/app.js.
  const INCIDENT_END_X = 800;
  const INCIDENT_CLEARANCE_PX = 25;
  const INCIDENT_LOOKAHEAD_PX = 60;
  const INCIDENT_MAX_SPEED_RATIO = 0.28;
  const INCIDENT_BRAKE_GAIN = 3;
  const RED_LIGHT_LOOKAHEAD_PX = 95;
  const RED_LIGHT_STOP_BUFFER_PX = 12;
  const RED_LIGHT_BRAKE_GAIN = 3;
  const FOLLOWING_GAP_PX = 54;
  const VEHICLE_BUFFER_PX = 16;
  const FOLLOWING_BRAKE_GAIN = 2.8;
  const MAX_ACCELERATION_MPS2 = 2.2;
  const MAX_BRAKING_MPS2 = 5.5;
  const HIGHWAY_HEADWAY_FACTOR = 0.9;
  const WAITING_SPEED_MPS = 1.3;
  const BUS_PRIORITY_EXTENSION_SECONDS = 7;
  const MIN_PHASE_HEADWAY_SECONDS = 6;
  const HIGHWAY_DIRECTIONS = ["east", "west"];
  const LANE_CHANGE_RATE_PX_PER_SECOND = 90;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createVehicle(id, direction, config, random) {
    const routeTable = config.mode === "highway" ? HIGHWAY_ROUTES : ROUTES;
    if (!routeTable[direction]) {
      throw new Error(`Unknown direction: ${direction}`);
    }
    const route = Object.assign({}, routeTable[direction]);
    const laneOffset = random() * LANE_JITTER_PX * 2 - LANE_JITTER_PX;
    const isBus = random() < BUS_SPAWN_PROBABILITY;
    const size = isBus ? 34 : 22;
    // Cars vary from 82%-100% of the limit; buses run at a steadier 90%.
    const speedRatio = isBus ? 0.9 : 0.82 + random() * 0.18;
    const speed = (config.speedLimit / 3.6) * speedRatio;
    const vehicle = {
      id,
      direction,
      route,
      isBus,
      position: route.start,
      progress: 0,
      laneOffset,
      baseLaneOffset: laneOffset,
      lane: 0,
      laneTargetOffset: laneOffset,
      speedRatio,
      speed,
      currentSpeed: speed,
      length: size,
      waiting: false,
      brakeDelayRemaining: 0,
      braking: false,
      brakeTargetSpeed: speed
    };
    updateVehicleCoordinates(vehicle);
    return vehicle;
  }

  function updateVehicleCoordinates(vehicle) {
    if (vehicle.route.axis === "x") {
      vehicle.x = vehicle.position;
      vehicle.y = vehicle.route.fixed + vehicle.laneOffset;
    } else {
      vehicle.x = vehicle.route.fixed + vehicle.laneOffset;
      vehicle.y = vehicle.position;
    }
  }

  /**
   * @param {string|null} prioritySignal "ew", "ns", or null for no priority.
   */
  function signalState(time, config, prioritySignal) {
    const cycle = Math.max(10, config.signalCycle);
    const minPhase = Math.min(MIN_PHASE_HEADWAY_SECONDS, cycle / 2);
    let ewGreen = cycle * clamp(config.greenSplit / 100, 0.2, 0.8);
    if (config.busPriority) {
      if (prioritySignal === "ew") {
        ewGreen = clamp(ewGreen + BUS_PRIORITY_EXTENSION_SECONDS, minPhase, cycle - minPhase);
      } else if (prioritySignal === "ns") {
        ewGreen = clamp(ewGreen - BUS_PRIORITY_EXTENSION_SECONDS, minPhase, cycle - minPhase);
      }
    }
    const phase = time % cycle;
    return {
      ew: phase < ewGreen ? "green" : "red",
      ns: phase < ewGreen ? "red" : "green"
    };
  }

  class TrafficSimulation {
    constructor(options) {
      const opts = options || {};
      this.random = opts.random || Math.random;
      this.reset(opts.config);
    }

    reset(config) {
      this.config = Object.assign({}, DEFAULT_CONFIG, config || {});
      this.time = 0;
      this.nextId = 1;
      this.resetVehicleState();
      this.completedTrips = 0;
    }

    activeDirections() {
      return this.config.mode === "highway" ? HIGHWAY_DIRECTIONS : DIRECTIONS;
    }

    computeSignal(prioritySignal) {
      return this.config.mode === "highway"
        ? { ew: "green", ns: "green" }
        : signalState(this.time, this.config, prioritySignal);
    }

    resetVehicleState() {
      this.vehicles = [];
      // Stagger first spawns so all directions do not emit at t=0.
      this.spawnTimers = Object.fromEntries(
        this.activeDirections().map((direction, index) => [direction, index * 0.6])
      );
      this.lastSignal = this.computeSignal(null);
    }

    setConfig(config) {
      const source = config || {};
      const previousMode = this.config.mode;
      const validated = {};
      for (const key of ["mode", "demand", "speedLimit", "signalCycle", "greenSplit", "incident", "busPriority", "reactionTime", "brakeBuildTime"]) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          validated[key] = source[key];
        }
      }
      if (validated.mode !== undefined) {
        validated.mode = validated.mode === "highway" ? "highway" : "intersection";
      }
      if (validated.demand !== undefined) {
        validated.demand = clamp(validated.demand, 10, 95);
      }
      if (validated.speedLimit !== undefined) {
        validated.speedLimit = Math.max(1, validated.speedLimit);
      }
      if (validated.signalCycle !== undefined) {
        validated.signalCycle = clamp(validated.signalCycle, 18, 90);
      }
      if (validated.greenSplit !== undefined) {
        validated.greenSplit = clamp(validated.greenSplit, 35, 70);
      }
      if (validated.incident !== undefined) {
        validated.incident = Boolean(validated.incident);
      }
      if (validated.busPriority !== undefined) {
        validated.busPriority = Boolean(validated.busPriority);
      }
      if (validated.reactionTime !== undefined) {
        validated.reactionTime = clamp(validated.reactionTime, 0, 3);
      }
      if (validated.brakeBuildTime !== undefined) {
        validated.brakeBuildTime = clamp(validated.brakeBuildTime, 0, 2);
      }
      this.config = Object.assign({}, this.config, validated);
      if (validated.mode !== undefined && validated.mode !== previousMode) {
        this.resetVehicleState();
      }
      for (const vehicle of this.vehicles) {
        vehicle.speed = (this.config.speedLimit / 3.6) * vehicle.speedRatio;
      }
    }

    refreshSignal(prioritySignal) {
      this.lastSignal = this.computeSignal(prioritySignal);
      return this.lastSignal;
    }

    findPriorityBus() {
      let best = null;
      let bestDistance = Infinity;
      for (const vehicle of this.vehicles) {
        const stop = STOP_LINES[vehicle.direction];
        const distanceToStop = (stop - vehicle.position) * vehicle.route.sign;
        if (vehicle.isBus && distanceToStop > 0 && distanceToStop < BUS_PRIORITY_DETECTION_PX) {
          if (distanceToStop < bestDistance) {
            best = vehicle;
            bestDistance = distanceToStop;
          }
        }
      }
      return best;
    }

    getPrioritySignal() {
      if (!this.config.busPriority || this.config.mode === "highway") {
        return null;
      }
      const priorityBus = this.findPriorityBus();
      return priorityBus ? priorityBus.route.signal : null;
    }

    step(deltaSeconds) {
      const dt = clamp(deltaSeconds ?? 0, 0, MAX_STEP_SECONDS);
      this.time += dt;
      this.spawnVehicles(dt);
      this.refreshSignal(this.getPrioritySignal());
      this.moveVehicles(dt);
      this.removeCompleted();
      return this.getSnapshot();
    }

    spawnVehicles(dt) {
      const demandFactor = clamp(this.config.demand / 100, 0.05, 1);
      // Produces roughly 0.95-3.3 seconds between spawns per direction.
      const baseInterval = 3.4 - demandFactor * 2.45;
      for (const direction of this.activeDirections()) {
        this.spawnTimers[direction] -= dt;
        if (this.spawnTimers[direction] <= 0) {
          if (this.canSpawn(direction)) {
            this.vehicles.push(createVehicle(this.nextId++, direction, this.config, this.random));
            this.spawnTimers[direction] = baseInterval * (0.75 + this.random() * 0.5);
          } else {
            this.spawnTimers[direction] = SPAWN_RETRY_SECONDS;
          }
        }
      }
    }

    canSpawn(direction) {
      const route = (this.config.mode === "highway" ? HIGHWAY_ROUTES : ROUTES)[direction];
      return !this.vehicles.some((vehicle) => {
        if (vehicle.direction !== direction) return false;
        return Math.abs(vehicle.position - route.start) < MIN_SPAWN_GAP_PX;
      });
    }

    moveVehicles(dt) {
      const byDirection = new Map(this.activeDirections().map((direction) => [direction, []]));
      for (const vehicle of this.vehicles) {
        byDirection.get(vehicle.direction).push(vehicle);
      }

      for (const direction of this.activeDirections()) {
        const routeVehicles = byDirection.get(direction).sort((a, b) => b.progress - a.progress);

        for (let index = 0; index < routeVehicles.length; index += 1) {
          const vehicle = routeVehicles[index];
          const leader = routeVehicles.slice(0, index).find((candidate) => candidate.lane === vehicle.lane) || null;
          const target = this.computeTargetSpeed(vehicle, leader);
          vehicle.waiting = target.waiting;
          const effectiveTarget = this.config.mode === "highway"
            ? this.applyBrakeDelay(vehicle, target.speed, dt)
            : target.speed;
          const speedDelta = effectiveTarget - vehicle.currentSpeed;
          const maxDelta = (speedDelta < 0 ? MAX_BRAKING_MPS2 : MAX_ACCELERATION_MPS2) * dt;
          vehicle.currentSpeed += clamp(speedDelta, -maxDelta, maxDelta);
          vehicle.currentSpeed = clamp(vehicle.currentSpeed, 0, vehicle.speed);
          vehicle.laneOffset += clamp(
            vehicle.laneTargetOffset - vehicle.laneOffset,
            -LANE_CHANGE_RATE_PX_PER_SECOND * dt,
            LANE_CHANGE_RATE_PX_PER_SECOND * dt
          );
          vehicle.position += vehicle.route.sign * vehicle.currentSpeed * PX_PER_METER * dt;
          vehicle.progress = Math.abs(vehicle.position - vehicle.route.start);
          updateVehicleCoordinates(vehicle);
        }
      }
    }

    applyBrakeDelay(vehicle, targetSpeed, dt) {
      // Keep one braking episode active from reaction delay through deceleration.
      const needsBraking = targetSpeed < vehicle.currentSpeed - 0.05;
      if (needsBraking && !vehicle.braking) {
        vehicle.braking = true;
        vehicle.brakeDelayRemaining = this.config.reactionTime + this.config.brakeBuildTime;
        vehicle.brakeTargetSpeed = targetSpeed;
      }
      if (!vehicle.braking) {
        return targetSpeed;
      }
      if (needsBraking) {
        vehicle.brakeTargetSpeed = Math.min(vehicle.brakeTargetSpeed, targetSpeed);
        vehicle.brakeDelayRemaining = Math.max(0, vehicle.brakeDelayRemaining - dt);
      } else {
        vehicle.brakeTargetSpeed = Math.max(vehicle.brakeTargetSpeed, targetSpeed);
        if (targetSpeed >= vehicle.speed - 0.05) {
          vehicle.braking = false;
          vehicle.brakeDelayRemaining = 0;
        }
      }
      if (vehicle.braking && vehicle.brakeDelayRemaining > 0) {
        return vehicle.currentSpeed;
      }
      return Math.min(targetSpeed, vehicle.brakeTargetSpeed);
    }

    computeTargetSpeed(vehicle, leader) {
      let target = vehicle.speed;
      let waiting = false;
      const stopLine = STOP_LINES[vehicle.direction];
      const distanceToStop = stopLine === undefined ? -1 : (stopLine - vehicle.position) * vehicle.route.sign;
      const signal = vehicle.route.signal ? this.lastSignal[vehicle.route.signal] : "green";

      if (this.config.mode !== "highway") {
        if (
          signal === "red" &&
          distanceToStop > 0 &&
          distanceToStop < RED_LIGHT_LOOKAHEAD_PX
        ) {
          target = Math.min(target, Math.max(0, (distanceToStop - RED_LIGHT_STOP_BUFFER_PX) / RED_LIGHT_BRAKE_GAIN));
          waiting = waiting || target < WAITING_SPEED_MPS;
        }
      }

      // The incident marker is positioned in the eastbound lane only.
      if (this.config.incident && vehicle.direction === "east") {
        const distanceToIncident = INCIDENT_START_X - vehicle.position;
        const incidentLookahead = Math.max(
          INCIDENT_LOOKAHEAD_PX,
          vehicle.currentSpeed * (this.config.mode === "highway"
            ? this.config.reactionTime + this.config.brakeBuildTime
            : 0) * PX_PER_METER +
            (vehicle.currentSpeed * vehicle.currentSpeed / (2 * MAX_BRAKING_MPS2)) * PX_PER_METER
        );
        const canChangeLane = this.config.mode === "highway" && vehicle.lane === 0 && this.canChangeIncidentLane(vehicle);
        if (this.config.mode === "highway" && vehicle.lane === 0 && distanceToIncident > 0 && distanceToIncident < incidentLookahead && canChangeLane) {
          vehicle.lane = 1;
          vehicle.laneTargetOffset = vehicle.baseLaneOffset + (vehicle.direction === "east" ? -40 : 40);
        } else if (
          distanceToIncident > 0 && distanceToIncident < incidentLookahead ||
          vehicle.position >= INCIDENT_START_X && vehicle.position <= INCIDENT_END_X + INCIDENT_CLEARANCE_PX
        ) {
          target = 0;
          waiting = true;
        }
      }

      if (leader) {
        const gap = (leader.position - vehicle.position) * vehicle.route.sign - (leader.length + vehicle.length) / 2;
        const desiredGap = this.config.mode === "highway"
          ? FOLLOWING_GAP_PX + vehicle.currentSpeed * this.config.reactionTime * PX_PER_METER * HIGHWAY_HEADWAY_FACTOR
          : FOLLOWING_GAP_PX;
        if (gap < desiredGap) {
          const gapError = desiredGap - gap;
          target = Math.min(target, Math.max(0, vehicle.currentSpeed - gapError / FOLLOWING_BRAKE_GAIN));
          waiting = waiting || target < WAITING_SPEED_MPS;
        }
      }

      return {
        speed: clamp(target, 0, vehicle.speed),
        waiting
      };
    }

    canChangeIncidentLane(vehicle) {
      if (this.config.mode !== "highway") return false;
      return !this.vehicles.some((other) => {
        if (other === vehicle || other.direction !== vehicle.direction || other.lane !== 1) return false;
        return Math.abs(other.position - vehicle.position) < 100;
      });
    }

    removeCompleted() {
      const before = this.vehicles.length;
      this.vehicles = this.vehicles.filter((vehicle) => {
        if (vehicle.route.sign > 0) return vehicle.position < vehicle.route.end;
        return vehicle.position > vehicle.route.end;
      });
      this.completedTrips += before - this.vehicles.length;
    }

    getMetrics() {
      const vehicleCount = this.vehicles.length;
      const avgMps = vehicleCount
        ? this.vehicles.reduce((sum, vehicle) => sum + vehicle.currentSpeed, 0) / vehicleCount
        : 0;
      return {
        averageSpeedKmh: Math.round(avgMps * 3.6),
        vehicleCount,
        queueLength: this.vehicles.filter((vehicle) => vehicle.waiting).length,
        brakingVehicles: this.vehicles.filter((vehicle) => vehicle.braking).length,
        completedTrips: this.completedTrips
      };
    }

    getSnapshot() {
      return {
        time: this.time,
        vehicles: this.vehicles.map((vehicle) => Object.assign({}, vehicle, {
          route: Object.assign({}, vehicle.route)
        })),
        signal: Object.assign({}, this.lastSignal),
        metrics: this.getMetrics(),
        config: Object.assign({}, this.config)
      };
    }
  }

  return {
    TrafficSimulation,
    DEFAULT_CONFIG,
    ROUTES,
    STOP_LINES,
    signalState,
    clamp,
    PX_PER_METER,
    MAX_STEP_SECONDS
  };
});
