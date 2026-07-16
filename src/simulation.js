(function initTrafficSimulation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TrafficSimulatorLib = api;
  }
})(globalThis, function factory() {
  "use strict";

  const DIRECTIONS = ["east", "west", "south", "north"];
  const DEFAULT_CONFIG = Object.freeze({
    mode: "intersection",
    demand: 52,
    speedLimit: 50,
    signalCycle: 42,
    greenSplit: 52,
    incident: false,
    busPriority: true,
    roadCondition: "dry",
    reactionTime: 1.2,
    brakeBuildTime: 0.5,
    seed: "demo-traffic"
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
  const INCIDENT_LANE_CLEARANCE_OFFSET_PX = 22;
  const INCIDENT_LOOKAHEAD_PX = 60;
  const INCIDENT_APPROACH_SPEED_RATIO = 0.58;
  const INCIDENT_BRAKE_GAIN = 3;
  const INCIDENT_MIN_DURATION_SECONDS = 30 * 60;
  const INCIDENT_MAX_DURATION_SECONDS = 2 * 60 * 60;
  const INCIDENT_FIRST_DELAY_MIN_SECONDS = 5 * 60;
  const INCIDENT_FIRST_DELAY_MAX_SECONDS = 15 * 60;
  const INCIDENT_REPEAT_DELAY_MIN_SECONDS = 15 * 60;
  const INCIDENT_REPEAT_DELAY_MAX_SECONDS = 45 * 60;
  const LANE_CHANGE_BACK_CLEARANCE_PX = 58;
  const LANE_CHANGE_FRONT_CLEARANCE_PX = 82;
  const LANE_CHANGE_SPEED_RATIO = 0.72;
  const LANE_CHANGE_SNAP_TOLERANCE_PX = 0.75;
  const LANE_CHANGE_MIN_DURATION_SECONDS = 2.2;
  const LANE_CHANGE_MAX_DURATION_SECONDS = 4.2;
  const LANE_CHANGE_MIN_DECISION_SECONDS = 0.7;
  const LANE_CHANGE_MAX_DECISION_SECONDS = 2.1;
  const LANE_CHANGE_MIN_COOLDOWN_SECONDS = 4;
  const LANE_CHANGE_MAX_COOLDOWN_SECONDS = 9;
  const OVERTAKE_LOOKAHEAD_PX = 230;
  const OVERTAKE_SPEED_ADVANTAGE_MPS = 1.5;
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
  const SIGNAL_CLEARANCE_SECONDS = 2;
  const HIGHWAY_DIRECTIONS = ["east", "west"];
  const LANE_WIDTH_PX = 36;
  const LANES_PER_DIRECTION = 2;
  // Below this closing speed, same-lane contact is treated as queue compression instead of a crash.
  const REAR_END_IMPACT_THRESHOLD_MPS = 0.65;
  const LATERAL_CONTACT_TOLERANCE_PX = 20;
  // Fraction of a frame; 0 means exact simultaneous crossing, 1 means a whole frame apart.
  const PATH_CROSSING_TIME_TOLERANCE = 0.35;
  const ROAD_CONDITIONS = Object.freeze({
    dry: Object.freeze({ label: "dry", brakingScale: 1, accelerationScale: 1, headwayScale: 1 }),
    wet: Object.freeze({ label: "wet", brakingScale: 0.68, accelerationScale: 0.9, headwayScale: 1.24 }),
    icy: Object.freeze({ label: "icy", brakingScale: 0.38, accelerationScale: 0.62, headwayScale: 1.75 })
  });
  const DRIVER_PROFILES = Object.freeze([
    Object.freeze({ type: "cautious", reactionScale: 1.18, headwayScale: 1.22, accelerationScale: 0.85, brakingScale: 0.92 }),
    Object.freeze({ type: "normal", reactionScale: 1, headwayScale: 1, accelerationScale: 1, brakingScale: 1 }),
    Object.freeze({ type: "assertive", reactionScale: 0.86, headwayScale: 0.88, accelerationScale: 1.12, brakingScale: 1.05 })
  ]);

  const ROAD_MODEL = Object.freeze({
    version: 1,
    canvas: Object.freeze({ width: 1120, height: 720 }),
    laneWidth: LANE_WIDTH_PX,
    lanesPerDirection: LANES_PER_DIRECTION,
    routes: Object.freeze({
      intersection: Object.freeze({
        east: Object.freeze({ axis: "x", start: -80, end: 1200, fixed: 330, sign: 1, signal: "ew" }),
        west: Object.freeze({ axis: "x", start: 1200, end: -80, fixed: 390, sign: -1, signal: "ew" }),
        south: Object.freeze({ axis: "y", start: -80, end: 800, fixed: 525, sign: 1, signal: "ns" }),
        north: Object.freeze({ axis: "y", start: 800, end: -80, fixed: 595, sign: -1, signal: "ns" })
      }),
      highway: Object.freeze({
        east: Object.freeze({ axis: "x", start: -80, end: 1200, fixed: 306, sign: 1, signal: null }),
        west: Object.freeze({ axis: "x", start: 1200, end: -80, fixed: 390, sign: -1, signal: null })
      })
    }),
    stopLines: Object.freeze({
      east: 492,
      west: 630,
      south: 292,
      north: 430
    }),
    laneOffsets: Object.freeze({
      intersection: Object.freeze({
        east: Object.freeze([0, -LANE_WIDTH_PX]),
        west: Object.freeze([0, LANE_WIDTH_PX]),
        south: Object.freeze([-18, 18]),
        north: Object.freeze([-18, 18])
      }),
      highway: Object.freeze({
        east: Object.freeze([0, -LANE_WIDTH_PX]),
        west: Object.freeze([0, LANE_WIDTH_PX])
      })
    }),
    layout: Object.freeze({
      horizontalRoadY: 276,
      verticalRoadX: 476,
      roadWidth: 170,
      centerX: 560,
      centerY: 360,
      intersection: Object.freeze([492, 292, 138, 138]),
      signals: Object.freeze([
        Object.freeze([464, 250, "ew"]),
        Object.freeze([656, 454, "ew"]),
        Object.freeze([438, 450, "ns"]),
        Object.freeze([676, 250, "ns"])
      ]),
      incident: Object.freeze([742, 306, 58, 34]),
      congestionOverlays: Object.freeze({
        east: Object.freeze([120, 296, 380, 48]),
        west: Object.freeze([620, 376, 380, 48]),
        south: Object.freeze([501, 70, 48, 230]),
        north: Object.freeze([571, 420, 48, 230])
      }),
      highway: Object.freeze({
        roadY: 234,
        roadHeight: 228,
        dividerY: 348,
        incident: Object.freeze([742, 292, 58, 44]),
        congestionOverlays: Object.freeze({
          east: Object.freeze([0, 282, 1120, 48]),
          west: Object.freeze([0, 366, 1120, 48])
        }),
        labelY: 264,
        footerY: 500
      })
    }),
    bounds: Object.freeze({
      intersection: Object.freeze({ left: 492, right: 630, top: 292, bottom: 430 }),
      incident: Object.freeze({ startX: INCIDENT_START_X, endX: INCIDENT_END_X })
    })
  });

  const ROUTES = ROAD_MODEL.routes.intersection;
  const HIGHWAY_ROUTES = ROAD_MODEL.routes.highway;
  const STOP_LINES = ROAD_MODEL.stopLines;
  const INTERSECTION_BOUNDS = ROAD_MODEL.bounds.intersection;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeSeed(seed) {
    // Programmatic callers may pass numbers or other primitives; seeds are normalized as labels.
    const normalized = String(seed ?? "").trim();
    // Empty or whitespace-only seeds fall back to the default reproducible scenario.
    // Use code points so truncation never splits a surrogate pair; the HTML maxlength is only a UI guard.
    return Array.from(normalized || DEFAULT_CONFIG.seed).slice(0, 64).join("");
  }

  function hashSeed(seed) {
    // Deterministic FNV-1a-style hash for repeatable demos; not for security use.
    let hash = 2166136261;
    for (const char of normalizeSeed(seed)) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 1;
  }

  function createSeededRandom(seed) {
    let state = hashSeed(seed);
    return function random() {
      state = Math.imul(1664525, state) + 1013904223;
      return (state >>> 0) / 4294967296;
    };
  }

  function laneCenterOffset(mode, direction, lane) {
    const offsets = ROAD_MODEL.laneOffsets[mode] && ROAD_MODEL.laneOffsets[mode][direction];
    if (!offsets) return 0;
    return offsets[clamp(lane, 0, offsets.length - 1)] || 0;
  }

  function laneOffsetForVehicle(config, direction, lane, laneJitter) {
    return laneCenterOffset(config.mode, direction, lane) + laneJitter;
  }

  function normalizeRoadCondition(value) {
    return Object.prototype.hasOwnProperty.call(ROAD_CONDITIONS, value) ? value : DEFAULT_CONFIG.roadCondition;
  }

  function roadConditionForConfig(config) {
    return ROAD_CONDITIONS[normalizeRoadCondition(config.roadCondition)];
  }

  function createDriverProfile(random) {
    const roll = random();
    const base = roll < 0.24
      ? DRIVER_PROFILES[0]
      : roll > 0.78 ? DRIVER_PROFILES[2] : DRIVER_PROFILES[1];
    return Object.assign({}, base);
  }

  function randomBetween(random, min, max) {
    return min + random() * (max - min);
  }

  function driverReactionTimeSeconds(vehicle, config) {
    const reactionScale = vehicle.driver ? vehicle.driver.reactionScale ?? 1 : 1;
    return config.reactionTime * reactionScale;
  }

  function driverHeadwayScale(vehicle, config) {
    const driverScale = vehicle.driver ? vehicle.driver.headwayScale ?? 1 : 1;
    return driverScale * roadConditionForConfig(config).headwayScale;
  }

  function effectiveMaxAccelerationMps2(vehicle, config) {
    const driverScale = vehicle.driver ? vehicle.driver.accelerationScale ?? 1 : 1;
    return MAX_ACCELERATION_MPS2 * driverScale * roadConditionForConfig(config).accelerationScale;
  }

  function effectiveMaxBrakingMps2(vehicle, config) {
    const driverScale = vehicle.driver ? vehicle.driver.brakingScale ?? 1 : 1;
    return MAX_BRAKING_MPS2 * driverScale * roadConditionForConfig(config).brakingScale;
  }

  function activeVehicleLanes(vehicle) {
    if (vehicle.laneChanging && vehicle.laneChange) {
      return [vehicle.laneChange.sourceLane, vehicle.laneChange.targetLane];
    }
    if (vehicle.targetLane !== undefined && vehicle.targetLane !== vehicle.lane) {
      return [vehicle.lane, vehicle.targetLane];
    }
    return [vehicle.lane];
  }

  function vehiclesShareLane(first, second) {
    const firstLanes = activeVehicleLanes(first);
    const secondLanes = activeVehicleLanes(second);
    return firstLanes.some((lane) => secondLanes.includes(lane));
  }

  function createVehicle(id, direction, config, random, laneOverride) {
    const routeTable = config.mode === "highway" ? HIGHWAY_ROUTES : ROUTES;
    if (!routeTable[direction]) {
      throw new Error(`Unknown direction: ${direction}`);
    }
    const route = Object.assign({}, routeTable[direction]);
    const lane = laneOverride === undefined ? Math.floor(random() * LANES_PER_DIRECTION) : laneOverride;
    const laneJitter = random() * LANE_JITTER_PX - LANE_JITTER_PX / 2;
    const laneOffset = laneOffsetForVehicle(config, direction, lane, laneJitter);
    const isBus = random() < BUS_SPAWN_PROBABILITY;
    const size = isBus ? 34 : 22;
    // Cars vary from 82%-100% of the limit; buses run at a steadier 90%.
    const speedRatio = isBus ? 0.9 : 0.82 + random() * 0.18;
    const speed = (config.speedLimit / 3.6) * speedRatio;
    const driver = isBus ? Object.assign({}, DRIVER_PROFILES[1]) : createDriverProfile(random);
    const vehicle = {
      id,
      direction,
      route,
      isBus,
      position: route.start,
      progress: 0,
      laneOffset,
      laneJitter,
      baseLaneOffset: laneOffset,
      lane,
      targetLane: lane,
      laneTargetOffset: laneOffset,
      laneChanging: false,
      laneChange: null,
      laneChangeIntent: null,
      laneChangeCooldown: randomBetween(random, 0, LANE_CHANGE_MIN_COOLDOWN_SECONDS),
      speedRatio,
      speed,
      currentSpeed: speed,
      driver,
      length: size,
      waiting: false,
      brakeDelayRemaining: 0,
      braking: false,
      brakeTargetSpeed: speed,
      crashed: false,
      collisionSpeedKmh: 0,
      crashClearAt: null,
      previousPosition: route.start,
      previousX: undefined,
      previousY: undefined
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

  function vehiclesOverlap(first, second) {
    const firstHorizontal = first.route.axis === "x";
    const secondHorizontal = second.route.axis === "x";
    const firstHalfWidth = firstHorizontal ? first.length / 2 : 10;
    const firstHalfHeight = firstHorizontal ? 10 : first.length / 2;
    const secondHalfWidth = secondHorizontal ? second.length / 2 : 10;
    const secondHalfHeight = secondHorizontal ? 10 : second.length / 2;
    return Math.abs(first.x - second.x) < firstHalfWidth + secondHalfWidth &&
      Math.abs(first.y - second.y) < firstHalfHeight + secondHalfHeight;
  }

  function velocityVector(vehicle) {
    const speed = vehicle.currentSpeed || 0;
    return vehicle.route.axis === "x"
      ? { x: speed * vehicle.route.sign, y: 0 }
      : { x: 0, y: speed * vehicle.route.sign };
  }

  function relativeImpactSpeedKmh(first, second) {
    const firstVelocity = velocityVector(first);
    const secondVelocity = velocityVector(second);
    const dx = firstVelocity.x - secondVelocity.x;
    const dy = firstVelocity.y - secondVelocity.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy) * 3.6);
  }

  function sameFlow(first, second) {
    return first.direction === second.direction &&
      first.route.axis === second.route.axis &&
      first.route.sign === second.route.sign &&
      vehiclesShareLane(first, second);
  }

  function signedGap(leader, follower, leaderPosition, followerPosition) {
    return (leaderPosition - followerPosition) * leader.route.sign -
      ((leader.length || 22) + (follower.length || 22)) / 2;
  }

  function rearEndCrossed(leader, follower) {
    const previousLeaderPosition = leader.previousPosition ?? leader.position;
    const previousFollowerPosition = follower.previousPosition ?? follower.position;
    const previousGap = signedGap(leader, follower, previousLeaderPosition, previousFollowerPosition);
    const currentGap = signedGap(leader, follower, leader.position, follower.position);
    return previousGap > 0 && currentGap <= 0;
  }

  function laterallyAlignedForContact(first, second) {
    if (first.route.axis !== second.route.axis) return true;
    const firstLateral = first.route.axis === "x" ? first.y : first.x;
    const secondLateral = second.route.axis === "x" ? second.y : second.x;
    return Math.abs(firstLateral - secondLateral) < LATERAL_CONTACT_TOLERANCE_PX;
  }

  function pathCrossingAlpha(previousPosition, currentPosition, crossingPosition) {
    const delta = currentPosition - previousPosition;
    if (Math.abs(delta) < 0.001) return null;
    const alpha = (crossingPosition - previousPosition) / delta;
    return alpha >= 0 && alpha <= 1 ? alpha : null;
  }

  function sweptPathCollision(first, second) {
    if (first.route.axis === second.route.axis) return false;
    const horizontal = first.route.axis === "x" ? first : second;
    const vertical = horizontal === first ? second : first;
    const hPreviousX = horizontal.previousX ?? horizontal.x;
    const vPreviousY = vertical.previousY ?? vertical.y;
    const horizontalAlpha = pathCrossingAlpha(hPreviousX, horizontal.x, vertical.x);
    const verticalAlpha = pathCrossingAlpha(vPreviousY, vertical.y, horizontal.y);
    if (horizontalAlpha === null || verticalAlpha === null) return false;
    // Allows small frame-to-frame timing mismatch while requiring both paths to reach the conflict point together.
    return Math.abs(horizontalAlpha - verticalAlpha) <= PATH_CROSSING_TIME_TOLERANCE;
  }

  function findClosestLeader(vehicle, candidates) {
    // O(n) per vehicle is acceptable at current demo scale; nearest-leader correctness matters during lane changes.
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      if (candidate === vehicle || !vehiclesShareLane(candidate, vehicle)) continue;
      const distance = (candidate.position - vehicle.position) * vehicle.route.sign;
      if (distance > 0 && distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  }

  function minimumVehicleSeparation(leader, follower) {
    return ((leader.length || 22) + (follower.length || 22)) / 2 + VEHICLE_BUFFER_PX;
  }

  function isRearEndImpact(leader, follower, contactDetected) {
    const closingSpeed = Math.max(0, follower.currentSpeed - (leader.currentSpeed || 0));
    return contactDetected &&
      closingSpeed > REAR_END_IMPACT_THRESHOLD_MPS &&
      laterallyAlignedForContact(leader, follower);
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
    const nsGreenStart = ewGreen + SIGNAL_CLEARANCE_SECONDS;
    const nsGreenEnd = cycle - SIGNAL_CLEARANCE_SECONDS;
    return {
      ew: phase < ewGreen ? "green" : "red",
      ns: phase >= nsGreenStart && phase < nsGreenEnd ? "green" : "red",
      phase,
      ewGreenEnd: ewGreen,
      nsGreenStart,
      nsGreenEnd
    };
  }

  class TrafficSimulation {
    constructor(options) {
      const opts = options || {};
      this.externalRandom = typeof opts.random === "function" ? opts.random : null;
      this.random = this.externalRandom || Math.random;
      this.incidentRandom = this.random;
      this.reset(opts.config);
    }

    reset(config) {
      this.config = Object.assign({}, DEFAULT_CONFIG, config || {});
      this.config.seed = normalizeSeed(this.config.seed);
      if (!this.externalRandom) {
        this.random = createSeededRandom(this.config.seed);
        this.incidentRandom = createSeededRandom(`${this.config.seed}:incidents`);
      } else {
        this.incidentRandom = this.externalRandom;
      }
      this.time = 0;
      this.nextId = 1;
      this.incidentCount = 0;
      this.resolvedCrashCount = 0;
      this.resetIncidentState();
      this.resetVehicleState();
      this.completedTrips = 0;
    }

    incidentDurationSeconds() {
      return randomBetween(this.incidentRandom, INCIDENT_MIN_DURATION_SECONDS, INCIDENT_MAX_DURATION_SECONDS);
    }

    scheduleNextIncident(firstIncident) {
      if (!this.config.incident) {
        this.nextIncidentAt = null;
        return;
      }
      const minDelay = firstIncident ? INCIDENT_FIRST_DELAY_MIN_SECONDS : INCIDENT_REPEAT_DELAY_MIN_SECONDS;
      const maxDelay = firstIncident ? INCIDENT_FIRST_DELAY_MAX_SECONDS : INCIDENT_REPEAT_DELAY_MAX_SECONDS;
      this.nextIncidentAt = this.time + randomBetween(this.incidentRandom, minDelay, maxDelay);
    }

    resetIncidentState() {
      this.activeIncident = null;
      this.scheduleNextIncident(true);
    }

    activateIncident(durationSeconds) {
      const requestedDuration = Number(durationSeconds);
      const duration = durationSeconds === undefined || !Number.isFinite(requestedDuration)
        ? this.incidentDurationSeconds()
        : clamp(requestedDuration, INCIDENT_MIN_DURATION_SECONDS, INCIDENT_MAX_DURATION_SECONDS);
      this.activeIncident = {
        startedAt: this.time,
        clearsAt: this.time + duration,
        durationSeconds: duration,
        direction: "east",
        lane: 0
      };
      this.nextIncidentAt = null;
      this.incidentCount += 1;
      return this.activeIncident;
    }

    clearIncident() {
      this.activeIncident = null;
      this.scheduleNextIncident(false);
    }

    updateIncidentState() {
      if (!this.config.incident) {
        this.activeIncident = null;
        this.nextIncidentAt = null;
        return;
      }
      if (this.activeIncident && this.time >= this.activeIncident.clearsAt) {
        this.clearIncident();
      } else if (!this.activeIncident && this.nextIncidentAt !== null && this.time >= this.nextIncidentAt) {
        this.activateIncident();
      }
    }

    incidentIsActive() {
      return Boolean(this.activeIncident);
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
        this.activeDirections().flatMap((direction, directionIndex) => {
          return Array.from({ length: LANES_PER_DIRECTION }, (_, lane) => [
            `${direction}:${lane}`,
            directionIndex * 0.6 + lane * 0.35
          ]);
        })
      );
      this.lastSignal = this.computeSignal(null);
    }

    setConfig(config) {
      const source = config || {};
      const previousMode = this.config.mode;
      const previousSeed = this.config.seed;
      const previousIncidentEnabled = this.config.incident;
      const validated = {};
      for (const key of ["mode", "demand", "speedLimit", "signalCycle", "greenSplit", "incident", "busPriority", "roadCondition", "reactionTime", "brakeBuildTime", "seed"]) {
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
      if (validated.roadCondition !== undefined) {
        validated.roadCondition = normalizeRoadCondition(validated.roadCondition);
      }
      if (validated.reactionTime !== undefined) {
        validated.reactionTime = clamp(validated.reactionTime, 0, 3);
      }
      if (validated.brakeBuildTime !== undefined) {
        validated.brakeBuildTime = clamp(validated.brakeBuildTime, 0, 2);
      }
      if (validated.seed !== undefined) {
        validated.seed = normalizeSeed(validated.seed);
      }
      this.config = Object.assign({}, this.config, validated);
      const seedChanged = validated.seed !== undefined && validated.seed !== previousSeed;
      const modeChanged = validated.mode !== undefined && validated.mode !== previousMode;
      if (!this.externalRandom && (seedChanged || modeChanged)) {
        this.random = createSeededRandom(this.config.seed);
        this.incidentRandom = createSeededRandom(`${this.config.seed}:incidents`);
      }
      if (modeChanged || seedChanged) {
        this.resetVehicleState();
      }
      if (modeChanged || seedChanged || this.config.incident !== previousIncidentEnabled) {
        this.resetIncidentState();
      }
      for (const vehicle of this.vehicles) {
        vehicle.speed = (this.config.speedLimit / 3.6) * vehicle.speedRatio;
      }
    }

    refreshSignal(prioritySignal) {
      const nextSignal = this.computeSignal(prioritySignal);
      if (this.config.mode === "intersection") {
        const opposingAxis = nextSignal.ew === "green" ? "ns" : "ew";
        const intersectionOccupied = this.vehicles.some((vehicle) => {
          return !vehicle.crashed && vehicle.route.signal === opposingAxis && this.vehicleInIntersection(vehicle);
        });
        this.lastSignal = intersectionOccupied
          ? { ew: "red", ns: "red" }
          : nextSignal;
      } else {
        this.lastSignal = nextSignal;
      }
      return this.lastSignal;
    }

    vehicleInIntersection(vehicle) {
      return vehicle.x >= INTERSECTION_BOUNDS.left && vehicle.x <= INTERSECTION_BOUNDS.right &&
        vehicle.y >= INTERSECTION_BOUNDS.top && vehicle.y <= INTERSECTION_BOUNDS.bottom;
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
      this.updateIncidentState();
      this.removeResolvedCrashes();
      this.spawnVehicles(dt);
      this.refreshSignal(this.getPrioritySignal());
      this.moveVehicles(dt);
      this.removeCompleted();
      this.detectCollisions();
      return this.getSnapshot();
    }

    spawnVehicles(dt) {
      const demandFactor = clamp(this.config.demand / 100, 0.05, 1);
      // Produces roughly 0.95-3.3 seconds between spawns per direction.
      const baseInterval = 3.4 - demandFactor * 2.45;
      for (const direction of this.activeDirections()) {
        for (let lane = 0; lane < LANES_PER_DIRECTION; lane += 1) {
          const timerKey = `${direction}:${lane}`;
          this.spawnTimers[timerKey] -= dt;
          if (this.spawnTimers[timerKey] <= 0) {
            if (this.canSpawn(direction, lane)) {
              this.vehicles.push(createVehicle(this.nextId++, direction, this.config, this.random, lane));
              this.spawnTimers[timerKey] = baseInterval * (0.75 + this.random() * 0.5);
            } else {
              this.spawnTimers[timerKey] = SPAWN_RETRY_SECONDS;
            }
          }
        }
      }
    }

    canSpawn(direction, lane) {
      const route = (this.config.mode === "highway" ? HIGHWAY_ROUTES : ROUTES)[direction];
      return !this.vehicles.some((vehicle) => {
        if (vehicle.direction !== direction) return false;
        if (lane !== undefined && vehicle.lane !== undefined && !activeVehicleLanes(vehicle).includes(lane)) return false;
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
          if (vehicle.crashed) continue;
          vehicle.laneChangeCooldown = Math.max(0, (vehicle.laneChangeCooldown || 0) - dt);
          this.evaluateLaneChange(vehicle, routeVehicles, dt);
          const leader = findClosestLeader(vehicle, routeVehicles);
          const target = this.computeTargetSpeed(vehicle, leader);
          vehicle.waiting = target.waiting;
          const effectiveTarget = this.config.mode === "highway"
            ? this.applyBrakeDelay(vehicle, target.speed, dt)
            : target.speed;
          const speedDelta = effectiveTarget - vehicle.currentSpeed;
          const maxDelta = (speedDelta < 0
            ? effectiveMaxBrakingMps2(vehicle, this.config)
            : effectiveMaxAccelerationMps2(vehicle, this.config)) * dt;
          vehicle.currentSpeed += clamp(speedDelta, -maxDelta, maxDelta);
          vehicle.currentSpeed = clamp(vehicle.currentSpeed, 0, vehicle.speed);
          this.advanceLaneChange(vehicle, dt);
          const previousPosition = vehicle.position;
          vehicle.previousPosition = previousPosition;
          vehicle.previousX = vehicle.x;
          vehicle.previousY = vehicle.y;
          vehicle.position += vehicle.route.sign * vehicle.currentSpeed * PX_PER_METER * dt;
          // The same leader reference drives braking and the hard boundary for this frame.
          this.enforceRedLightBoundary(vehicle, previousPosition);
          this.enforceIncidentBoundary(vehicle, previousPosition);
          this.enforceFollowingBoundary(vehicle, leader);
          vehicle.progress = Math.abs(vehicle.position - vehicle.route.start);
          updateVehicleCoordinates(vehicle);
        }
      }
    }

    enforceFollowingBoundary(vehicle, leader) {
      if (!leader || vehicle.crashed || !sameFlow(vehicle, leader)) return;
      const minimumSeparation = minimumVehicleSeparation(leader, vehicle);
      const currentSeparation = (leader.position - vehicle.position) * vehicle.route.sign;
      if (
        leader.crashed &&
        isRearEndImpact(leader, vehicle, currentSeparation < minimumSeparation)
      ) {
        // Crashed leaders are physical obstacles; record a same-frame rear-end impact before clamping.
        this.markCollision(vehicle, leader, relativeImpactSpeedKmh(vehicle, leader));
        return;
      }
      if (currentSeparation >= minimumSeparation) return;
      // Last-resort physical clamp: braking should normally preserve this gap before contact.
      vehicle.position = leader.position - vehicle.route.sign * minimumSeparation;
      vehicle.currentSpeed = Math.min(vehicle.currentSpeed, leader.currentSpeed || 0);
      vehicle.waiting = true;
      updateVehicleCoordinates(vehicle);
    }

    enforceRedLightBoundary(vehicle, previousPosition) {
      if (this.config.mode === "highway" || !vehicle.route.signal) return;
      if (this.lastSignal[vehicle.route.signal] !== "red") return;
      const stopLine = STOP_LINES[vehicle.direction];
      const distanceBefore = (stopLine - previousPosition) * vehicle.route.sign;
      const safeBoundary = stopLine - vehicle.route.sign * (RED_LIGHT_STOP_BUFFER_PX + vehicle.length / 2);
      const crossedBoundary = vehicle.route.sign > 0
        ? previousPosition < safeBoundary && vehicle.position >= safeBoundary
        : previousPosition > safeBoundary && vehicle.position <= safeBoundary;
      if (distanceBefore > 0 && crossedBoundary) {
        vehicle.position = safeBoundary;
        vehicle.currentSpeed = 0;
        vehicle.waiting = true;
        updateVehicleCoordinates(vehicle);
      }
    }

    enforceIncidentBoundary(vehicle, previousPosition) {
      if (!this.incidentIsActive() || this.config.mode !== "highway" || vehicle.direction !== "east") return;
      const incidentBounds = ROAD_MODEL.bounds.incident;
      const laneOffset = vehicle.laneOffset ?? 0;
      const laneBlocked = activeVehicleLanes(vehicle).includes(0) ||
        (vehicle.targetLane === 1 && Math.abs(laneOffset) < INCIDENT_LANE_CLEARANCE_OFFSET_PX);
      if (!laneBlocked) return;

      const stopPosition = incidentBounds.startX - vehicle.length / 2 - VEHICLE_BUFFER_PX;
      const crossedBoundary = previousPosition < stopPosition && vehicle.position >= stopPosition;
      const insideIncident = vehicle.position >= incidentBounds.startX && vehicle.position <= incidentBounds.endX + INCIDENT_CLEARANCE_PX;
      if (crossedBoundary) {
        vehicle.position = stopPosition;
      }
      if (crossedBoundary || insideIncident) {
        vehicle.currentSpeed = 0;
        vehicle.waiting = true;
        updateVehicleCoordinates(vehicle);
      }
    }

    applyBrakeDelay(vehicle, targetSpeed, dt) {
      // Keep one braking episode active from reaction delay through deceleration.
      const needsBraking = targetSpeed < vehicle.currentSpeed - 0.05;
      if (needsBraking && !vehicle.braking) {
        vehicle.braking = true;
        vehicle.brakeDelayRemaining = driverReactionTimeSeconds(vehicle, this.config) + this.config.brakeBuildTime;
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

    startLaneChange(vehicle, targetLane) {
      if (vehicle.laneChanging || vehicle.lane === targetLane) return;
      const laneJitter = vehicle.laneJitter || 0;
      const driverDurationScale = vehicle.driver && vehicle.driver.type === "cautious"
        ? 1.12
        : (vehicle.driver && vehicle.driver.type === "assertive" ? 0.88 : 1);
      const duration = clamp(
        randomBetween(this.random, LANE_CHANGE_MIN_DURATION_SECONDS, LANE_CHANGE_MAX_DURATION_SECONDS) * driverDurationScale,
        LANE_CHANGE_MIN_DURATION_SECONDS,
        LANE_CHANGE_MAX_DURATION_SECONDS
      );
      vehicle.targetLane = targetLane;
      vehicle.laneTargetOffset = laneOffsetForVehicle(this.config, vehicle.direction, targetLane, laneJitter);
      vehicle.laneChanging = true;
      vehicle.laneChange = {
        sourceLane: vehicle.lane,
        targetLane,
        reason: vehicle.laneChangeIntent ? vehicle.laneChangeIntent.reason : "traffic",
        startOffset: vehicle.laneOffset,
        endOffset: vehicle.laneTargetOffset,
        elapsed: 0,
        duration
      };
      vehicle.laneChangeIntent = null;
    }

    advanceLaneChange(vehicle, dt) {
      if (!vehicle.laneChanging || !vehicle.laneChange) return;
      const change = vehicle.laneChange;
      change.startOffset = change.startOffset ?? vehicle.laneOffset;
      change.endOffset = change.endOffset ?? vehicle.laneTargetOffset;
      change.elapsed = (change.elapsed || 0) + dt;
      change.duration = Math.max(change.duration || LANE_CHANGE_MIN_DURATION_SECONDS, 0.1);
      const progress = clamp(change.elapsed / change.duration, 0, 1);
      const smoothProgress = progress * progress * (3 - 2 * progress);
      vehicle.laneOffset = change.startOffset + (change.endOffset - change.startOffset) * smoothProgress;
      if (progress < 1 && Math.abs(vehicle.laneTargetOffset - vehicle.laneOffset) >= LANE_CHANGE_SNAP_TOLERANCE_PX) return;
      vehicle.laneOffset = vehicle.laneTargetOffset;
      vehicle.lane = vehicle.targetLane;
      vehicle.laneChanging = false;
      vehicle.laneChange = null;
      vehicle.laneChangeCooldown = randomBetween(
        this.random,
        LANE_CHANGE_MIN_COOLDOWN_SECONDS,
        LANE_CHANGE_MAX_COOLDOWN_SECONDS
      );
    }

    closestVehicleInLane(vehicle, candidates, lane, ahead) {
      let closest = null;
      let closestDistance = Infinity;
      for (const other of candidates) {
        if (other === vehicle || other.direction !== vehicle.direction || !activeVehicleLanes(other).includes(lane)) continue;
        const relativePosition = (other.position - vehicle.position) * vehicle.route.sign;
        if ((ahead && relativePosition <= 0) || (!ahead && relativePosition >= 0)) continue;
        const distance = Math.abs(relativePosition);
        if (distance < closestDistance) {
          closest = other;
          closestDistance = distance;
        }
      }
      return closest ? { vehicle: closest, distance: closestDistance } : null;
    }

    laneExpectedSpeed(vehicle, candidates, lane) {
      const leader = this.closestVehicleInLane(vehicle, candidates, lane, true);
      return leader && leader.distance < OVERTAKE_LOOKAHEAD_PX
        ? leader.vehicle.currentSpeed || 0
        : vehicle.speed;
    }

    canChangeLane(vehicle, targetLane, candidates) {
      if (this.config.mode !== "highway" || targetLane < 0 || targetLane >= LANES_PER_DIRECTION) return false;
      const laneVehicles = candidates || this.vehicles;
      const front = this.closestVehicleInLane(vehicle, laneVehicles, targetLane, true);
      const rear = this.closestVehicleInLane(vehicle, laneVehicles, targetLane, false);
      const reactionSeconds = driverReactionTimeSeconds(vehicle, this.config) + this.config.brakeBuildTime;
      const frontClearance = Math.max(
        LANE_CHANGE_FRONT_CLEARANCE_PX,
        vehicle.currentSpeed * reactionSeconds * PX_PER_METER * 0.32
      ) + (vehicle.length || 22) / 2;
      if (front && front.distance < frontClearance + (front.vehicle.length || 22) / 2) return false;
      if (!rear) return true;
      const rearSpeed = rear.vehicle.currentSpeed || 0;
      const rearClosingSpeed = Math.max(0, rearSpeed - vehicle.currentSpeed);
      const rearClearance = LANE_CHANGE_BACK_CLEARANCE_PX +
        rearSpeed * reactionSeconds * PX_PER_METER * 0.24 +
        rearClosingSpeed * reactionSeconds * PX_PER_METER * 0.35 +
        (rear.vehicle.length || 22) / 2;
      return rear.distance >= rearClearance;
    }

    requestLaneChange(vehicle, targetLane, reason) {
      if (vehicle.laneChangeIntent && vehicle.laneChangeIntent.targetLane === targetLane && vehicle.laneChangeIntent.reason === reason) return;
      const reactionScale = vehicle.driver ? vehicle.driver.reactionScale ?? 1 : 1;
      vehicle.laneChangeIntent = {
        targetLane,
        reason,
        decisionRemaining: randomBetween(
          this.random,
          LANE_CHANGE_MIN_DECISION_SECONDS,
          LANE_CHANGE_MAX_DECISION_SECONDS
        ) * reactionScale
      };
    }

    evaluateLaneChange(vehicle, candidates, dt) {
      if (this.config.mode !== "highway" || vehicle.laneChanging || vehicle.lane === undefined) return;
      const currentLeader = this.closestVehicleInLane(vehicle, candidates, vehicle.lane, true);
      const incidentDistance = this.incidentIsActive() && vehicle.direction === "east" && vehicle.lane === 0
        ? ROAD_MODEL.bounds.incident.startX - vehicle.position
        : -1;
      const maxBraking = effectiveMaxBrakingMps2(vehicle, this.config);
      const incidentRecognitionDistance = Math.max(
        OVERTAKE_LOOKAHEAD_PX,
        vehicle.currentSpeed * (driverReactionTimeSeconds(vehicle, this.config) + this.config.brakeBuildTime) * PX_PER_METER +
          vehicle.currentSpeed * vehicle.currentSpeed / (2 * maxBraking) * PX_PER_METER
      );
      const incidentAhead = incidentDistance > 0 && incidentDistance < incidentRecognitionDistance;
      const incidentBlocksReturn = this.incidentIsActive() &&
        vehicle.direction === "east" &&
        vehicle.position <= ROAD_MODEL.bounds.incident.endX + INCIDENT_CLEARANCE_PX;
      let targetLane = null;
      let reason = null;

      if (incidentAhead) {
        targetLane = 1;
        reason = "incident";
      } else if (
        vehicle.lane === 0 &&
        currentLeader &&
        currentLeader.distance < OVERTAKE_LOOKAHEAD_PX &&
        this.laneExpectedSpeed(vehicle, candidates, 1) >= (currentLeader.vehicle.currentSpeed || 0) + OVERTAKE_SPEED_ADVANTAGE_MPS
      ) {
        targetLane = 1;
        reason = "overtake";
      } else if (
        vehicle.lane === 1 &&
        vehicle.laneChangeCooldown <= 0 &&
        !incidentBlocksReturn &&
        this.laneExpectedSpeed(vehicle, candidates, 0) >= vehicle.currentSpeed * 0.9
      ) {
        targetLane = 0;
        reason = "return";
      }

      if (targetLane === null) {
        vehicle.laneChangeIntent = null;
        return;
      }
      this.requestLaneChange(vehicle, targetLane, reason);
      vehicle.laneChangeIntent.decisionRemaining = Math.max(0, vehicle.laneChangeIntent.decisionRemaining - dt);
      if (
        vehicle.laneChangeIntent.decisionRemaining <= 0 &&
        vehicle.laneChangeCooldown <= 0 &&
        this.canChangeLane(vehicle, targetLane, candidates)
      ) {
        this.startLaneChange(vehicle, targetLane);
      }
    }

    computeTargetSpeed(vehicle, leader) {
      let target = vehicle.speed;
      let waiting = false;
      const stopLine = STOP_LINES[vehicle.direction];
      const distanceToStop = stopLine === undefined ? -1 : (stopLine - vehicle.position) * vehicle.route.sign;
      const signal = vehicle.route.signal ? this.lastSignal[vehicle.route.signal] : "green";

      if (this.config.mode !== "highway") {
        const maxBraking = effectiveMaxBrakingMps2(vehicle, this.config);
        const reactionDistance = vehicle.currentSpeed * driverReactionTimeSeconds(vehicle, this.config) * 0.35 * PX_PER_METER;
        const signalLookahead = Math.max(
          RED_LIGHT_LOOKAHEAD_PX,
          (vehicle.currentSpeed * vehicle.currentSpeed / (2 * maxBraking)) * PX_PER_METER +
            reactionDistance
        );
        if (
          signal === "red" &&
          distanceToStop > 0 &&
          distanceToStop < signalLookahead
        ) {
          target = 0;
          waiting = true;
        }
      }

      // The scheduled incident marker closes the eastbound lane nearest its fixed road position.
      if (this.incidentIsActive() && vehicle.direction === "east") {
        const incidentBounds = ROAD_MODEL.bounds.incident;
        const distanceToIncident = incidentBounds.startX - vehicle.position;
        const maxBraking = effectiveMaxBrakingMps2(vehicle, this.config);
        const reactionSeconds = this.config.mode === "highway"
          ? driverReactionTimeSeconds(vehicle, this.config) + this.config.brakeBuildTime
          : driverReactionTimeSeconds(vehicle, this.config) * 0.35;
        const incidentLookahead = Math.max(
          INCIDENT_LOOKAHEAD_PX,
          vehicle.currentSpeed * reactionSeconds * PX_PER_METER +
            (vehicle.currentSpeed * vehicle.currentSpeed / (2 * maxBraking)) * PX_PER_METER
        );
        const usesBlockedLane = activeVehicleLanes(vehicle).includes(0);
        if (this.config.mode === "highway" && usesBlockedLane) {
          if (
            distanceToIncident > 0 && distanceToIncident < incidentLookahead ||
            vehicle.position >= incidentBounds.startX && vehicle.position <= incidentBounds.endX + INCIDENT_CLEARANCE_PX
          ) {
            const stoppingDistancePx = Math.max(
              0,
              distanceToIncident - vehicle.length / 2 - VEHICLE_BUFFER_PX
            );
            const safeApproachSpeed = Math.sqrt(2 * maxBraking * stoppingDistancePx / PX_PER_METER) * 0.72;
            const maneuverRatio = vehicle.laneChanging
              ? LANE_CHANGE_SPEED_RATIO
              : INCIDENT_APPROACH_SPEED_RATIO;
            target = Math.min(target, vehicle.speed * maneuverRatio, safeApproachSpeed);
            waiting = waiting || target < WAITING_SPEED_MPS;
          }
        } else if (
          this.config.mode !== "highway" &&
          usesBlockedLane &&
          (distanceToIncident > 0 && distanceToIncident < incidentLookahead ||
            vehicle.position >= incidentBounds.startX && vehicle.position <= incidentBounds.endX + INCIDENT_CLEARANCE_PX)
        ) {
          target = 0;
          waiting = true;
        }
        if (
          this.config.mode === "highway" &&
          vehicle.targetLane === 1 &&
          vehicle.laneOffset !== undefined &&
          Math.abs(vehicle.laneOffset) < INCIDENT_LANE_CLEARANCE_OFFSET_PX
        ) {
          target = Math.min(target, vehicle.speed * LANE_CHANGE_SPEED_RATIO);
          waiting = waiting || target < WAITING_SPEED_MPS;
        }
      }

      if (leader) {
        const gap = (leader.position - vehicle.position) * vehicle.route.sign - (leader.length + vehicle.length) / 2;
        const maxBraking = effectiveMaxBrakingMps2(vehicle, this.config);
        const reactionSeconds = driverReactionTimeSeconds(vehicle, this.config);
        const desiredGap = this.config.mode === "highway"
          ? FOLLOWING_GAP_PX + vehicle.currentSpeed * reactionSeconds * PX_PER_METER * HIGHWAY_HEADWAY_FACTOR * driverHeadwayScale(vehicle, this.config)
          : FOLLOWING_GAP_PX * driverHeadwayScale(vehicle, this.config);
        const closingSpeed = Math.max(0, vehicle.currentSpeed - leader.currentSpeed);
        const responseTime = this.config.mode === "highway"
          ? reactionSeconds + this.config.brakeBuildTime
          : 0.35;
        const reactionDistance = closingSpeed * responseTime * PX_PER_METER;
        const brakingDistance = closingSpeed * closingSpeed / (2 * maxBraking) * PX_PER_METER;
        const safeGap = desiredGap + reactionDistance + brakingDistance;
        if (gap < safeGap) {
          const gapRatio = clamp((gap - VEHICLE_BUFFER_PX) / Math.max(1, safeGap), 0, 1);
          const physicalTarget = leader.currentSpeed * gapRatio;
          target = Math.min(target, Math.max(0, physicalTarget));
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
      return this.canChangeLane(vehicle, 1, this.vehicles);
    }

    detectCollisions() {
      for (let firstIndex = 0; firstIndex < this.vehicles.length; firstIndex += 1) {
        const first = this.vehicles[firstIndex];
        for (let secondIndex = firstIndex + 1; secondIndex < this.vehicles.length; secondIndex += 1) {
          const second = this.vehicles[secondIndex];
          const overlapping = vehiclesOverlap(first, second);
          const sameFlowPair = sameFlow(first, second);
          const leader = sameFlowPair ? (first.progress >= second.progress ? first : second) : null;
          const follower = sameFlowPair ? (leader === first ? second : first) : null;
          const rearEnded = sameFlowPair ? rearEndCrossed(leader, follower) : false;
          // Swept checks catch vehicles that cross between frames before their final boxes overlap.
          const swept = !overlapping && (sameFlowPair
            ? rearEnded
            : sweptPathCollision(first, second));
          const collided = overlapping || swept;
          if (!collided) continue;
          if (sameFlowPair) {
            if (first.crashed && second.crashed) continue;
            if (isRearEndImpact(leader, follower, rearEnded || overlapping)) {
              this.markCollision(first, second, relativeImpactSpeedKmh(first, second));
            } else {
              this.separateCollisionPair(first, second);
              follower.currentSpeed = Math.min(follower.currentSpeed, leader.currentSpeed);
              follower.waiting = true;
            }
            continue;
          }
          if (first.crashed && second.crashed) continue;
          this.markCollision(first, second, relativeImpactSpeedKmh(first, second));
        }
      }
    }

    markCollision(first, second, impactSpeedKmh) {
      const crashClearAt = first.crashClearAt || second.crashClearAt || this.time + this.incidentDurationSeconds();
      first.crashed = true;
      second.crashed = true;
      first.currentSpeed = 0;
      second.currentSpeed = 0;
      first.collisionSpeedKmh = impactSpeedKmh;
      second.collisionSpeedKmh = impactSpeedKmh;
      first.crashClearAt = crashClearAt;
      second.crashClearAt = crashClearAt;
      first.waiting = true;
      second.waiting = true;
      this.separateCollisionPair(first, second);
    }

    separateCollisionPair(first, second) {
      if (sameFlow(first, second)) {
        const leader = first.progress >= second.progress ? first : second;
        const follower = leader === first ? second : first;
        const separation = minimumVehicleSeparation(leader, follower);
        follower.position = leader.position - leader.route.sign * separation;
      } else {
        first.position -= first.route.sign * VEHICLE_BUFFER_PX / 2;
        second.position -= second.route.sign * VEHICLE_BUFFER_PX / 2;
      }
      updateVehicleCoordinates(first);
      updateVehicleCoordinates(second);
    }

    removeCompleted() {
      const before = this.vehicles.length;
      this.vehicles = this.vehicles.filter((vehicle) => {
        if (vehicle.route.sign > 0) return vehicle.position < vehicle.route.end;
        return vehicle.position > vehicle.route.end;
      });
      this.completedTrips += before - this.vehicles.length;
    }

    removeResolvedCrashes() {
      const before = this.vehicles.length;
      this.vehicles = this.vehicles.filter((vehicle) => {
        return !vehicle.crashed || !vehicle.crashClearAt || vehicle.crashClearAt > this.time;
      });
      this.resolvedCrashCount += before - this.vehicles.length;
    }

    getIncidentSnapshot() {
      return {
        enabled: Boolean(this.config.incident),
        active: this.incidentIsActive(),
        startedAt: this.activeIncident ? this.activeIncident.startedAt : null,
        clearsAt: this.activeIncident ? this.activeIncident.clearsAt : null,
        nextStartAt: this.activeIncident ? null : this.nextIncidentAt,
        remainingSeconds: this.activeIncident
          ? Math.max(0, this.activeIncident.clearsAt - this.time)
          : null,
        startsInSeconds: !this.activeIncident && this.nextIncidentAt !== null
          ? Math.max(0, this.nextIncidentAt - this.time)
          : null,
        count: this.incidentCount
      };
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
        collisionVehicles: this.vehicles.filter((vehicle) => vehicle.crashed).length,
        collisionSeverityKmh: this.vehicles.reduce((max, vehicle) => Math.max(max, vehicle.collisionSpeedKmh || 0), 0),
        completedTrips: this.completedTrips,
        resolvedCrashVehicles: this.resolvedCrashCount,
        incidentActive: this.incidentIsActive(),
        incidentRemainingSeconds: this.activeIncident ? Math.max(0, this.activeIncident.clearsAt - this.time) : null,
        nextIncidentSeconds: !this.activeIncident && this.nextIncidentAt !== null ? Math.max(0, this.nextIncidentAt - this.time) : null
      };
    }

    serializeVehicle(vehicle) {
      // Export is a stable report schema, so it intentionally includes a smaller field set than snapshots.
      return {
        id: vehicle.id,
        direction: vehicle.direction,
        lane: vehicle.lane,
        targetLane: vehicle.targetLane,
        laneChanging: Boolean(vehicle.laneChanging),
        laneChangeReason: vehicle.laneChange ? vehicle.laneChange.reason : null,
        position: Number(vehicle.position.toFixed(2)),
        currentSpeed: Number(vehicle.currentSpeed.toFixed(3)),
        driverType: vehicle.driver ? vehicle.driver.type : "normal",
        waiting: Boolean(vehicle.waiting),
        braking: Boolean(vehicle.braking),
        crashed: Boolean(vehicle.crashed),
        collisionSpeedKmh: vehicle.collisionSpeedKmh || 0,
        crashClearAt: vehicle.crashClearAt === null || vehicle.crashClearAt === undefined
          ? null
          : Number(vehicle.crashClearAt.toFixed(2))
      };
    }

    serializeScenario() {
      const snapshot = this.getSnapshot();
      return {
        schemaVersion: 3,
        roadModelVersion: ROAD_MODEL.version,
        seed: this.config.seed,
        config: Object.assign({}, this.config),
        time: snapshot.time,
        incident: snapshot.incident,
        metrics: snapshot.metrics,
        vehicles: snapshot.vehicles.map((vehicle) => this.serializeVehicle(vehicle))
      };
    }

    getSnapshot() {
      return {
        time: this.time,
        vehicles: this.vehicles.map((vehicle) => Object.assign({}, vehicle, {
          route: Object.assign({}, vehicle.route)
        })),
        signal: Object.assign({}, this.lastSignal),
        incident: this.getIncidentSnapshot(),
        metrics: this.getMetrics(),
        config: Object.assign({}, this.config),
        roadModelVersion: ROAD_MODEL.version
      };
    }
  }

  return {
    TrafficSimulation,
    DEFAULT_CONFIG,
    ROUTES,
    HIGHWAY_ROUTES,
    ROAD_MODEL,
    ROAD_CONDITIONS,
    STOP_LINES,
    signalState,
    clamp,
    normalizeSeed,
    createSeededRandom,
    PX_PER_METER,
    MAX_STEP_SECONDS,
    INCIDENT_MIN_DURATION_SECONDS,
    INCIDENT_MAX_DURATION_SECONDS
  };
});
