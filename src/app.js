(function runApp() {
  "use strict";

  const translations = {
    en: {
      title: "Traffic Simulation Console", subtitle: "Compare intersection flow with highway traffic and delayed braking effects.",
      language: "Language", simulationSpeed: "Simulation Speed", pause: "Pause", resume: "Resume", reset: "Reset", metrics: "Live Metrics",
      averageSpeed: "Average Speed", vehiclesInNetwork: "Vehicles in Network", queueLength: "Queue Length", brakingVehicles: "Braking Vehicles", collisionVehicles: "Collision Vehicles", collisionSeverity: "Impact Speed", completedTrips: "Completed Trips",
      scenarioControls: "Scenario Controls", roadwayMode: "Roadway Mode", intersection: "Intersection", highway: "Highway", signalStatus: "Signal status", ewGreen: "East-West GREEN", nsGreen: "North-South GREEN", allRed: "ALL RED",
      trafficDemand: "Traffic Demand", speedLimit: "Speed Limit", roadCondition: "Road Condition", dryRoad: "Dry", wetRoad: "Wet", icyRoad: "Icy", signalCycle: "Signal Cycle", greenSplit: "Green Split",
      reactionTime: "Driver Reaction Time", brakeBuildTime: "Brake Build-up Time", incidentBottleneck: "Enable Random Incidents", busPriority: "Bus Signal Priority",
      scenarioSeed: "Scenario Seed", seedRestartHint: "Changing the seed restarts the scenario.", exportScenario: "Export JSON", scenarioJson: "Scenario JSON Snapshot", scenarioPlaceholder: "Export JSON to capture the current scenario.",
      whatToWatch: "What to Watch", noteCongestion: "Red road segments show congestion, while yellow segments show lower speeds.",
      noteIncident: "Seeded incidents appear at random times and clear automatically after 30–120 simulated minutes.", noteBus: "Bus priority extends the green phase when a bus approaches the intersection.",
      noteBraking: "Highway braking delay combines reaction time with brake build-up time before deceleration begins.", notePhysics: "Wet and icy roads reduce friction, lengthen stopping distance, and increase following gaps.", highwayLabel: "HIGHWAY",
      brakingExperiment: "Delayed braking experiment", incident: "Incident", startupTitle: "Traffic simulation failed to start",
      startupDetail: "Make sure the required files loaded, then refresh the page.", loopError: "The simulation hit an error. Press Reset or refresh the page.",
      incidentStatus: "Incident Status", incidentOff: "Off", incidentScheduled: "Starts in {minutes} min", incidentClearing: "Clears in {minutes} min",
      status: "Average speed {speed} km/h, vehicles in network {vehicles}, queue length {queue}, completed trips {trips}", unitKmh: "km/h", unitSec: "sec"
    },
    "zh-TW": {
      title: "交通模擬控制台", subtitle: "比較路口車流、高速公路車流與煞車遞延效應。", language: "語言", simulationSpeed: "模擬速度", pause: "暫停", resume: "繼續", reset: "重設", metrics: "即時指標",
      averageSpeed: "平均速度", vehiclesInNetwork: "網路車輛數", queueLength: "排隊長度", brakingVehicles: "煞車中車輛", collisionVehicles: "碰撞車輛", collisionSeverity: "碰撞衝擊速度", completedTrips: "完成旅次", scenarioControls: "情境控制",
      roadwayMode: "道路模式", intersection: "路口", highway: "高速公路", signalStatus: "號誌狀態", ewGreen: "東西向綠燈", nsGreen: "南北向綠燈", allRed: "全紅清空", trafficDemand: "交通需求", speedLimit: "速限", roadCondition: "路面狀態", dryRoad: "乾燥", wetRoad: "濕滑", icyRoad: "結冰", signalCycle: "號誌週期", greenSplit: "綠燈比例",
      reactionTime: "駕駛反應時間", brakeBuildTime: "煞車建立時間", incidentBottleneck: "啟用隨機事故", busPriority: "公車號誌優先",
      scenarioSeed: "情境 Seed", seedRestartHint: "變更 seed 會重新開始情境。", exportScenario: "匯出 JSON", scenarioJson: "情境 JSON 快照", scenarioPlaceholder: "匯出 JSON 以擷取目前情境。", whatToWatch: "觀察重點",
      noteCongestion: "紅色路段代表壅塞，黃色路段代表速度較低。", noteIncident: "事故依 Seed 隨機出現，並在模擬時間 30–120 分鐘後自動解除。",
      noteBus: "公車接近路口時，公車優先會延長綠燈時間。", noteBraking: "高速公路煞車遞延由反應時間與煞車建立時間共同決定。",
      notePhysics: "濕滑與結冰路面會降低摩擦、拉長煞停距離並增加跟車距離。",
      highwayLabel: "高速公路", brakingExperiment: "煞車遞延實驗", incident: "事故", startupTitle: "交通模擬啟動失敗",
      startupDetail: "請確認必要檔案已載入，然後重新整理頁面。", loopError: "模擬發生錯誤，請按重設或重新整理頁面。", incidentStatus: "事故狀態", incidentOff: "關閉", incidentScheduled: "{minutes} 分鐘後發生", incidentClearing: "{minutes} 分鐘後解除",
      status: "平均速度 {speed} 公里/小時，網路車輛 {vehicles}，排隊長度 {queue}，完成旅次 {trips}", unitKmh: "公里/小時", unitSec: "秒"
    }
  };
  let language = localStorage.getItem("traffic-simulator-language") || "en";
  if (!translations[language]) language = "en";
  const t = (key) => translations[language][key] || translations.en[key] || key;

  // This script relies on the defer attribute in index.html, so the DOM is fully parsed here.
  function renderStartupError() {
    const main = document.createElement("main");
    const title = document.createElement("h1");
    const detail = document.createElement("p");
    main.className = "startup-error";
    title.textContent = t("startupTitle");
    detail.textContent = t("startupDetail");
    main.append(title, detail);
    document.body.replaceChildren(main);
  }

  let startupErrorHandled = false;
  function startupErrorListener(event) {
    if (startupErrorHandled) return;
    const filename = event.filename || "";
    // Resource load errors arrive via event.target; runtime errors identify the script in event.filename.
    // Catches network-level failures loading simulation.js; runtime failures are handled by the lib check below.
    const isScriptLoadError = event.target instanceof HTMLScriptElement &&
      event.target.src.includes("src/simulation.js");
    const isAppScript = filename.includes("/src/app.js") || filename.includes("/src/simulation.js");
    if (isScriptLoadError || isAppScript) {
      startupErrorHandled = true;
      renderStartupError();
    }
  }
  window.addEventListener("error", startupErrorListener, true);

  function requireElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing #${id} element`);
    }
    return element;
  }

  const canvas = requireElement("trafficCanvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is not available");
  }
  const logicalWidth = canvas.width;
  const logicalHeight = canvas.height;
  let deviceScale = 1;
  let dprQuery = null;
  let backgroundGradient = null;

  function handleDprChange() {
    configureCanvasScale();
    trackDprChanges();
  }

  function configureCanvasScale() {
    deviceScale = window.devicePixelRatio || 1;
    canvas.width = logicalWidth * deviceScale;
    canvas.height = logicalHeight * deviceScale;
    context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    backgroundGradient = context.createLinearGradient(0, 0, logicalWidth, logicalHeight);
    backgroundGradient.addColorStop(0, "#dbeafe");
    backgroundGradient.addColorStop(1, "#ecfdf5");
  }

  function trackDprChanges() {
    if (dprQuery) {
      dprQuery.removeEventListener("change", handleDprChange);
    }
    dprQuery = window.matchMedia(`(resolution: ${deviceScale}dppx)`);
    dprQuery.addEventListener("change", handleDprChange);
  }

  function handleResize() {
    if ((window.devicePixelRatio || 1) !== deviceScale) {
      handleDprChange();
    }
  }

  configureCanvasScale();
  trackDprChanges();
  window.addEventListener("resize", handleResize);
  const controls = {
    mode: requireElement("mode"),
    demand: requireElement("demand"),
    speedLimit: requireElement("speedLimit"),
    roadCondition: requireElement("roadCondition"),
    signalCycle: requireElement("signalCycle"),
    greenSplit: requireElement("greenSplit"),
    incident: requireElement("incident"),
    busPriority: requireElement("busPriority"),
    reactionTime: requireElement("reactionTime"),
    brakeBuildTime: requireElement("brakeBuildTime")
  };
  const languageControl = requireElement("language");
  const simulationSpeedControl = requireElement("simulationSpeed");
  const outputs = {
    demand: requireElement("demandOut"),
    speedLimit: requireElement("speedOut"),
    signalCycle: requireElement("cycleOut"),
    greenSplit: requireElement("greenOut"),
    reactionTime: requireElement("reactionOut"),
    brakeBuildTime: requireElement("brakeBuildOut")
  };
  const metrics = {
    avgSpeed: requireElement("avgSpeed"),
    vehicleCount: requireElement("vehicleCount"),
    queueLength: requireElement("queueLength"),
    brakingVehicles: requireElement("brakingVehicles"),
    collisionVehicles: requireElement("collisionVehicles"),
    collisionSeverity: requireElement("collisionSeverity"),
    completedTrips: requireElement("completedTrips"),
    incidentStatus: requireElement("incidentStatus"),
    status: requireElement("trafficStatus")
  };
  const toggleRun = requireElement("toggleRun");
  const resetRun = requireElement("resetRun");
  const seedControl = requireElement("scenarioSeed");
  const exportScenario = requireElement("exportScenario");
  const scenarioOutput = requireElement("scenarioOutput");
  // Queue-count thresholds used only for visual congestion overlays.
  const congestionOverlayThreshold = 2;
  const congestionHeavyThreshold = 8;
  const directionAngles = {
    east: 0,
    west: Math.PI,
    south: Math.PI / 2,
    north: (3 * Math.PI) / 2
  };

  if (
    !window.TrafficSimulatorLib ||
    !window.TrafficSimulatorLib.TrafficSimulation ||
    !window.TrafficSimulatorLib.ROAD_MODEL ||
    !window.TrafficSimulatorLib.DEFAULT_CONFIG ||
    !window.TrafficSimulatorLib.normalizeSeed
  ) {
    throw new Error("TrafficSimulatorLib failed to load. Check that src/simulation.js is present.");
  }

  const layout = window.TrafficSimulatorLib.ROAD_MODEL.layout;
  const normalizeSeed = window.TrafficSimulatorLib.normalizeSeed;
  let committedSeed;
  commitSeedFromControl();
  const simulation = new window.TrafficSimulatorLib.TrafficSimulation({ config: readConfig() });
  let running = true;
  let lastFrame = performance.now();
  let lastA11yUpdate = 0;
  let pausedSnapshot = null;
  let loopError = false;

  function commitSeedFromControl() {
    const seed = normalizeSeed(seedControl.value);
    committedSeed = seed;
    seedControl.value = seed;
    return seed;
  }

  function readConfig() {
    return {
      mode: controls.mode.value,
      demand: Number(controls.demand.value),
      speedLimit: Number(controls.speedLimit.value),
      roadCondition: controls.roadCondition.value,
      signalCycle: Number(controls.signalCycle.value),
      greenSplit: Number(controls.greenSplit.value),
      incident: controls.incident.checked,
      busPriority: controls.busPriority.checked,
      reactionTime: Number(controls.reactionTime.value),
      brakeBuildTime: Number(controls.brakeBuildTime.value),
      seed: committedSeed
    };
  }

  function updateOutputs() {
    outputs.demand.textContent = `${controls.demand.value}%`;
    outputs.speedLimit.textContent = `${controls.speedLimit.value} ${t("unitKmh")}`;
    outputs.signalCycle.textContent = `${controls.signalCycle.value} ${t("unitSec")}`;
    outputs.greenSplit.textContent = `${controls.greenSplit.value}%`;
    outputs.reactionTime.textContent = `${controls.reactionTime.value} ${t("unitSec")}`;
    outputs.brakeBuildTime.textContent = `${controls.brakeBuildTime.value} ${t("unitSec")}`;
    const highwayMode = controls.mode.value === "highway";
    controls.reactionTime.disabled = !highwayMode;
    controls.brakeBuildTime.disabled = !highwayMode;
  }

  function applyLanguage(nextLanguage) {
    language = translations[nextLanguage] ? nextLanguage : "en";
    localStorage.setItem("traffic-simulator-language", language);
    document.documentElement.lang = language === "zh-TW" ? "zh-Hant" : "en";
    languageControl.value = language;
    for (const element of document.querySelectorAll("[data-i18n]")) {
      element.textContent = t(element.dataset.i18n);
    }
    languageControl.setAttribute("aria-label", t("language"));
    scenarioOutput.setAttribute("placeholder", t("scenarioPlaceholder"));
    updateOutputs();
    toggleRun.textContent = running ? t("pause") : t("resume");
    exportScenario.textContent = t("exportScenario");
  }

  function writeScenarioOutput() {
    const data = simulation.serializeScenario();
    const json = JSON.stringify(data, null, 2);
    scenarioOutput.value = json;
    return json;
  }

  function clearScenarioOutput() {
    scenarioOutput.value = "";
  }

  function seedForFilename(seed) {
    return seed.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "scenario";
  }

  function restartSimulation(options) {
    const opts = options || {};
    const nextRunning = opts.forceRunning ? true : running;
    const wasErrored = loopError;
    simulation.reset(readConfig());
    const snapshot = simulation.getSnapshot();
    running = nextRunning;
    toggleRun.textContent = running ? t("pause") : t("resume");
    pausedSnapshot = running ? null : snapshot;
    clearScenarioOutput();
    loopError = false;
    lastFrame = performance.now();
    try {
      draw(snapshot);
    } catch (error) {
      loopError = true;
      running = false;
      console.error("Draw error during reset:", error);
      renderLoopError(t("loopError"));
      return;
    }
    if (wasErrored) {
      // Normal operation already has an active RAF loop; only restart after error shutdown.
      requestAnimationFrame(loop);
    }
  }

  function bindControls() {
    languageControl.addEventListener("change", () => applyLanguage(languageControl.value));
    simulationSpeedControl.addEventListener("change", () => {
      lastFrame = performance.now();
    });
    for (const input of Object.values(controls)) {
      input.addEventListener("input", () => {
        updateOutputs();
        const modeChanged = input === controls.mode;
        const config = readConfig();
        if (modeChanged) {
          // Switching roadway models requires fresh routes and spawn timers.
          simulation.reset(config);
        } else {
          simulation.setConfig(config);
        }
        if (!running) {
          simulation.refreshSignal(simulation.getPrioritySignal());
          pausedSnapshot = simulation.getSnapshot();
        } else {
          // Clear the paused snapshot reference while the live loop owns rendering.
          pausedSnapshot = null;
        }
        clearScenarioOutput();
      });
    }
    // Use change rather than input so typing a seed does not reset traffic on every keystroke.
    seedControl.addEventListener("change", () => {
      const previousSeed = committedSeed;
      commitSeedFromControl();
      if (committedSeed === previousSeed) return;
      restartSimulation();
    });
    exportScenario.addEventListener("click", () => {
      const json = writeScenarioOutput();
      const blob = new Blob([json], { type: "application/json" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `traffic-scenario-${seedForFilename(committedSeed)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    });
    toggleRun.addEventListener("click", () => {
      running = !running;
      toggleRun.textContent = running ? t("pause") : t("resume");
      pausedSnapshot = running ? null : simulation.getSnapshot();
      lastFrame = performance.now();
    });
    resetRun.addEventListener("click", () => {
      commitSeedFromControl();
      restartSimulation({ forceRunning: true });
    });
  }

  function drawRoads(snapshot) {
    const signal = snapshot.signal;
    if (snapshot.config.mode === "highway") {
      drawHighway(snapshot);
      return;
    }
    context.fillStyle = "#26323f";
    context.fillRect(0, layout.horizontalRoadY, logicalWidth, layout.roadWidth);
    context.fillRect(layout.verticalRoadX, 0, layout.roadWidth, logicalHeight);

    context.strokeStyle = "#f8d96a";
    context.lineWidth = 3;
    context.setLineDash([24, 24]);
    context.beginPath();
    context.moveTo(0, layout.centerY);
    context.lineTo(logicalWidth, layout.centerY);
    context.moveTo(0, 312);
    context.lineTo(logicalWidth, 312);
    context.moveTo(0, 408);
    context.lineTo(logicalWidth, 408);
    context.moveTo(layout.centerX, 0);
    context.lineTo(layout.centerX, logicalHeight);
    context.moveTo(543, 0);
    context.lineTo(543, logicalHeight);
    context.moveTo(613, 0);
    context.lineTo(613, logicalHeight);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "#111827";
    context.fillRect(...layout.intersection);

    const signalStatus = signal.ew === "green"
      ? t("ewGreen")
      : signal.ns === "green" ? t("nsGreen") : t("allRed");
    context.fillStyle = "#18212f";
    context.font = "700 15px system-ui";
    context.fillText(`${t("signalStatus")}: ${signalStatus}`, 24, 34);

    for (const [x, y, axis] of layout.signals) {
      if (signal[axis] === undefined) {
        throw new Error(`Unknown signal axis: ${axis}`);
      }
      drawSignal(x, y, signal[axis] === "green");
    }

    if (snapshot.incident.active) {
      const [incidentX, incidentY, incidentWidth, incidentHeight] = layout.incident;
      context.save();
      context.fillStyle = "#ef4444";
      context.fillRect(incidentX, incidentY, incidentWidth, incidentHeight);
      context.fillStyle = "#fee2e2";
      context.font = "700 15px system-ui";
      context.fillText(t("incident"), incidentX + 5, incidentY + incidentHeight * 0.68, incidentWidth - 10);
      context.restore();
    }
  }

  function drawHighway(snapshot) {
    const highway = layout.highway;
    context.fillStyle = "#26323f";
    context.fillRect(0, highway.roadY, logicalWidth, highway.roadHeight);
    context.fillStyle = "#111827";
    context.fillRect(0, highway.dividerY, logicalWidth, 4);
    context.strokeStyle = "#f8d96a";
    context.lineWidth = 3;
    context.setLineDash([24, 24]);
    context.beginPath();
    context.moveTo(0, 288);
    context.lineTo(logicalWidth, 288);
    context.moveTo(0, 408);
    context.lineTo(logicalWidth, 408);
    context.moveTo(0, highway.dividerY);
    context.lineTo(logicalWidth, highway.dividerY);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#dbeafe";
    context.font = "600 15px system-ui";
    context.fillText(t("highwayLabel"), 24, highway.labelY);
    context.fillText(t("brakingExperiment"), 24, highway.footerY);
    const [incidentX, incidentY, incidentWidth, incidentHeight] = highway.incident;
    if (snapshot.incident.active) {
      context.fillStyle = "#ef4444";
      context.fillRect(incidentX, incidentY, incidentWidth, incidentHeight);
      context.fillStyle = "#fee2e2";
      context.font = "700 15px system-ui";
      context.fillText(t("incident"), incidentX + 5, incidentY + incidentHeight * 0.68, incidentWidth - 10);
    }
  }

  function drawSignal(x, y, isGreen) {
    context.fillStyle = "#111827";
    context.fillRect(x, y, 28, 54);
    context.beginPath();
    context.arc(x + 14, y + 16, 8, 0, Math.PI * 2);
    context.fillStyle = isGreen ? "#233044" : "#ef4444";
    context.fill();
    context.beginPath();
    context.arc(x + 14, y + 38, 8, 0, Math.PI * 2);
    context.fillStyle = isGreen ? "#22c55e" : "#233044";
    context.fill();
  }

  function renderLoopError(message) {
    context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    context.fillStyle = "rgba(17, 24, 39, 0.86)";
    context.fillRect(0, 0, logicalWidth, logicalHeight);
    context.fillStyle = "#ffffff";
    context.font = "700 24px system-ui";
    context.fillText(message, 32, 56, logicalWidth - 64);
  }

  function drawVehicles(snapshot) {
    for (const vehicle of snapshot.vehicles) {
      context.save();
      context.translate(vehicle.x, vehicle.y);
      const angle = directionAngles[vehicle.direction];
      if (angle === undefined) {
        throw new Error(`Unknown vehicle direction: ${vehicle.direction}`);
      }
      context.rotate(angle);
      context.fillStyle = vehicle.crashed
        ? "#991b1b"
        : (vehicle.braking
          ? "#f97316"
          : (vehicle.isBus ? (vehicle.waiting ? "#0369a1" : "#38bdf8") : (vehicle.waiting ? "#f97316" : "#e5e7eb")));
      context.strokeStyle = vehicle.isBus ? "#075985" : "#334155";
      context.lineWidth = 2;
      context.beginPath();
      roundRect(context, -vehicle.length / 2, -10, vehicle.length, 20, 5);
      context.fill();
      context.stroke();
      context.fillStyle = "#111827";
      context.fillRect(vehicle.length / 2 - 7, -5, 4, 10);
      if (vehicle.braking) {
        context.fillStyle = "#ef4444";
        context.fillRect(-vehicle.length / 2 + 3, -6, 4, 4);
        context.fillRect(-vehicle.length / 2 + 3, 2, 4, 4);
      }
      if (vehicle.crashed) {
        context.strokeStyle = "#fecaca";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(-vehicle.length / 2 + 4, -6);
        context.lineTo(vehicle.length / 2 - 4, 6);
        context.moveTo(-vehicle.length / 2 + 4, 6);
        context.lineTo(vehicle.length / 2 - 4, -6);
        context.stroke();
      }
      const lanePlan = vehicle.laneChange || vehicle.laneChangeIntent;
      const signaling = lanePlan && Math.floor(snapshot.time * 2) % 2 === 0;
      if (signaling) {
        const side = lanePlan.targetLane > vehicle.lane ? -1 : 1;
        context.fillStyle = "#facc15";
        context.fillRect(vehicle.length / 2 - 6, side > 0 ? 6 : -9, 4, 3);
        context.fillRect(-vehicle.length / 2 + 2, side > 0 ? 6 : -9, 4, 3);
      }
      context.restore();
    }
  }

  function roundRect(ctx, x, y, width, height, radius) {
    // Caller owns the path lifecycle and must call ctx.beginPath() first.
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, width, height, radius);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawCongestion(snapshot) {
    const queueByDirection = {};
    for (const vehicle of snapshot.vehicles) {
      if (vehicle.waiting) {
        queueByDirection[vehicle.direction] = (queueByDirection[vehicle.direction] || 0) + 1;
      }
    }
    const overlays = snapshot.config.mode === "highway"
      ? layout.highway.congestionOverlays
      : layout.congestionOverlays;
    for (const [direction, rect] of Object.entries(overlays)) {
      const queue = queueByDirection[direction] || 0;
      if (queue > congestionOverlayThreshold) {
        context.fillStyle = queue > congestionHeavyThreshold ? "rgba(239, 68, 68, 0.34)" : "rgba(245, 158, 11, 0.28)";
        context.fillRect(...rect);
      }
    }
  }

  function draw(snapshot) {
    context.clearRect(0, 0, logicalWidth, logicalHeight);
    context.fillStyle = backgroundGradient;
    context.fillRect(0, 0, logicalWidth, logicalHeight);

    drawRoads(snapshot);
    drawCongestion(snapshot);
    drawVehicles(snapshot);
    updateMetrics(snapshot.metrics);
  }

  function updateMetrics(data) {
    metrics.avgSpeed.textContent = `${data.averageSpeedKmh} ${t("unitKmh")}`;
    metrics.vehicleCount.textContent = String(data.vehicleCount);
    metrics.queueLength.textContent = String(data.queueLength);
    metrics.brakingVehicles.textContent = String(data.brakingVehicles);
    metrics.collisionVehicles.textContent = String(data.collisionVehicles);
    metrics.collisionSeverity.textContent = `${data.collisionSeverityKmh} ${t("unitKmh")}`;
    metrics.completedTrips.textContent = String(data.completedTrips);
    if (data.incidentActive) {
      metrics.incidentStatus.textContent = t("incidentClearing").replace(
        "{minutes}",
        Math.max(1, Math.ceil(data.incidentRemainingSeconds / 60))
      );
    } else if (data.nextIncidentSeconds !== null) {
      metrics.incidentStatus.textContent = t("incidentScheduled").replace(
        "{minutes}",
        Math.max(1, Math.ceil(data.nextIncidentSeconds / 60))
      );
    } else {
      metrics.incidentStatus.textContent = t("incidentOff");
    }
    const now = performance.now();
    if (now - lastA11yUpdate > 1000) {
      metrics.status.textContent = t("status")
        .replace("{speed}", data.averageSpeedKmh)
        .replace("{vehicles}", data.vehicleCount)
        .replace("{queue}", data.queueLength)
        .replace("{trips}", data.completedTrips);
      lastA11yUpdate = now;
    }
  }

  function loop(now) {
    if (loopError) {
      return;
    }

    try {
      const dt = Math.min((now - lastFrame) / 1000, 0.25);
      lastFrame = now;
      let snapshot = pausedSnapshot || simulation.getSnapshot();
      if (running) {
        let remainingSimulationTime = dt * Number(simulationSpeedControl.value);
        while (remainingSimulationTime > 0) {
          const stepSeconds = Math.min(window.TrafficSimulatorLib.MAX_STEP_SECONDS, remainingSimulationTime);
          snapshot = simulation.step(stepSeconds);
          remainingSimulationTime -= stepSeconds;
        }
      }
      draw(snapshot);
    } catch (error) {
      loopError = true;
      running = false;
      console.error("Simulation loop error:", error);
      renderLoopError(t("loopError"));
      return;
    }
    requestAnimationFrame(loop);
  }

  applyLanguage(language);
  bindControls();
  window.removeEventListener("error", startupErrorListener, true);
  requestAnimationFrame(loop);
})();
