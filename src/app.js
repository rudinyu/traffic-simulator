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
      incidentFrequency: "Incident Frequency", frequencyLow: "Low", frequencyNormal: "Normal", frequencyHigh: "High", incidentSeverity: "Incident Severity", severityMixed: "Mixed", severityMinor: "Minor", severityMajor: "Major",
      advancedScenarios: "Advanced Scenarios", turningTraffic: "Turning Traffic", rampMerge: "Highway Ramp Merge", laneClosure: "Lane Closure", emergencyVehicles: "Emergency Vehicles", pedestrianPhase: "Pedestrian Phase", redLightRunning: "Red-light Violations",
      scenarioSeed: "Scenario Seed", seedRestartHint: "Changing the seed restarts the scenario.", exportScenario: "Export JSON", importScenario: "Import JSON", exportCsv: "Export CSV", captureBaseline: "Set Baseline", scenarioJson: "Scenario JSON Snapshot", scenarioPlaceholder: "Paste scenario JSON here or export the current state.",
      importSuccess: "Scenario restored exactly.", importError: "The scenario JSON is invalid.", baselineSaved: "Baseline saved", baselineEmpty: "Set a baseline to compare the current run.", analysis: "Analysis", recentEvents: "Recent Events", noEvents: "No events yet", roadWork: "Work zone", pedestrianActive: "Pedestrian crossing active",
      comparison: "Speed {speed}, queue {queue}, trips {trips} versus baseline", eventIncidentStart: "Incident started", eventIncidentClear: "Incident cleared", eventCollision: "Collision", eventCollisionClear: "Collision cleared", eventLaneChange: "Lane change", eventRampEntry: "Ramp entry", eventRampMerge: "Ramp merge", eventRedLightRun: "Red-light violation",
      whatToWatch: "What to Watch", noteCongestion: "Red road segments show congestion, while yellow segments show lower speeds.",
      noteIncident: "Seeded incidents use moving traffic; optional red-light violations can create conflicts during signal changes.", noteBus: "Bus priority extends the green phase when a bus approaches the intersection.",
      noteBraking: "Highway braking delay combines reaction time with brake build-up time before deceleration begins.", notePhysics: "Wet and icy roads reduce friction, lengthen stopping distance, and increase following gaps.", highwayLabel: "HIGHWAY",
      brakingExperiment: "Delayed braking experiment", incident: "Incident", startupTitle: "Traffic simulation failed to start",
      startupDetail: "Make sure the required files loaded, then refresh the page.", loopError: "The simulation hit an error. Press Reset or refresh the page.",
      incidentStatus: "Incident Status", incidentOff: "Off", incidentScheduled: "Starts in {time}", incidentClearing: "Clears in {time}",
      status: "Average speed {speed} km/h, vehicles in network {vehicles}, queue length {queue}, completed trips {trips}", unitKmh: "km/h", unitMin: "min", unitSec: "sec"
    },
    "zh-TW": {
      title: "交通模擬控制台", subtitle: "比較路口車流、高速公路車流與煞車遞延效應。", language: "語言", simulationSpeed: "模擬速度", pause: "暫停", resume: "繼續", reset: "重設", metrics: "即時指標",
      averageSpeed: "平均速度", vehiclesInNetwork: "網路車輛數", queueLength: "排隊長度", brakingVehicles: "煞車中車輛", collisionVehicles: "碰撞車輛", collisionSeverity: "碰撞衝擊速度", completedTrips: "完成旅次", scenarioControls: "情境控制",
      roadwayMode: "道路模式", intersection: "路口", highway: "高速公路", signalStatus: "號誌狀態", ewGreen: "東西向綠燈", nsGreen: "南北向綠燈", allRed: "全紅清空", trafficDemand: "交通需求", speedLimit: "速限", roadCondition: "路面狀態", dryRoad: "乾燥", wetRoad: "濕滑", icyRoad: "結冰", signalCycle: "號誌週期", greenSplit: "綠燈比例",
      reactionTime: "駕駛反應時間", brakeBuildTime: "煞車建立時間", incidentBottleneck: "啟用隨機事故", busPriority: "公車號誌優先",
      incidentFrequency: "事故頻率", frequencyLow: "低", frequencyNormal: "一般", frequencyHigh: "高", incidentSeverity: "事故嚴重度", severityMixed: "混合", severityMinor: "輕微", severityMajor: "重大",
      advancedScenarios: "進階情境", turningTraffic: "轉向車流", rampMerge: "高速公路匝道匯入", laneClosure: "車道施工封閉", emergencyVehicles: "緊急車輛", pedestrianPhase: "行人專用時相", redLightRunning: "闖紅燈違規",
      scenarioSeed: "情境 Seed", seedRestartHint: "變更 seed 會重新開始情境。", exportScenario: "匯出 JSON", importScenario: "匯入 JSON", exportCsv: "匯出 CSV", captureBaseline: "設定基準", scenarioJson: "情境 JSON 快照", scenarioPlaceholder: "可貼上情境 JSON，或匯出目前狀態。", importSuccess: "已精確還原情境。", importError: "情境 JSON 格式無效。", baselineSaved: "已儲存基準", baselineEmpty: "設定基準後可比較目前模擬。", analysis: "分析", recentEvents: "最近事件", noEvents: "尚無事件", roadWork: "施工", pedestrianActive: "行人通行中", comparison: "相較基準：速度 {speed}、排隊 {queue}、旅次 {trips}", eventIncidentStart: "事故發生", eventIncidentClear: "事故解除", eventCollision: "碰撞", eventCollisionClear: "碰撞排除", eventLaneChange: "換道", eventRampEntry: "匝道進入", eventRampMerge: "匝道匯入", eventRedLightRun: "闖紅燈違規",
      whatToWatch: "觀察重點",
      noteCongestion: "紅色路段代表壅塞，黃色路段代表速度較低。", noteIncident: "事故由移動車流觸發；可選的闖紅燈違規會在號誌切換時形成衝突。",
      noteBus: "公車接近路口時，公車優先會延長綠燈時間。", noteBraking: "高速公路煞車遞延由反應時間與煞車建立時間共同決定。",
      notePhysics: "濕滑與結冰路面會降低摩擦、拉長煞停距離並增加跟車距離。",
      highwayLabel: "高速公路", brakingExperiment: "煞車遞延實驗", incident: "事故", startupTitle: "交通模擬啟動失敗",
      startupDetail: "請確認必要檔案已載入，然後重新整理頁面。", loopError: "模擬發生錯誤，請按重設或重新整理頁面。", incidentStatus: "事故狀態", incidentOff: "關閉", incidentScheduled: "{time}後發生", incidentClearing: "{time}後解除",
      status: "平均速度 {speed} 公里/小時，網路車輛 {vehicles}，排隊長度 {queue}，完成旅次 {trips}", unitKmh: "公里/小時", unitMin: "分", unitSec: "秒"
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
    incidentFrequency: requireElement("incidentFrequency"),
    incidentSeverity: requireElement("incidentSeverity"),
    busPriority: requireElement("busPriority"),
    turningTraffic: requireElement("turningTraffic"),
    rampMerge: requireElement("rampMerge"),
    laneClosure: requireElement("laneClosure"),
    emergencyVehicles: requireElement("emergencyVehicles"),
    pedestrianPhase: requireElement("pedestrianPhase"),
    redLightRunning: requireElement("redLightRunning"),
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
  const importScenario = requireElement("importScenario");
  const exportCsv = requireElement("exportCsv");
  const captureBaseline = requireElement("captureBaseline");
  const scenarioFile = requireElement("scenarioFile");
  const scenarioOutput = requireElement("scenarioOutput");
  const scenarioMessage = requireElement("scenarioMessage");
  const metricsChart = requireElement("metricsChart");
  const metricsChartContext = metricsChart.getContext("2d");
  const comparisonSummary = requireElement("comparisonSummary");
  const eventLog = requireElement("eventLog");
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
  let baselineMetrics = null;
  let simulationDebtSeconds = 0;
  let lastReportUpdate = 0;

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
      incidentFrequency: controls.incidentFrequency.value,
      incidentSeverity: controls.incidentSeverity.value,
      busPriority: controls.busPriority.checked,
      turningTraffic: controls.turningTraffic.checked,
      rampMerge: controls.rampMerge.checked,
      laneClosure: controls.laneClosure.checked,
      emergencyVehicles: controls.emergencyVehicles.checked,
      pedestrianPhase: controls.pedestrianPhase.checked,
      redLightRunning: controls.redLightRunning.checked,
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
    controls.rampMerge.disabled = !highwayMode;
    controls.turningTraffic.disabled = highwayMode;
    controls.pedestrianPhase.disabled = highwayMode;
    controls.redLightRunning.disabled = highwayMode;
    controls.busPriority.disabled = highwayMode;
    controls.incidentFrequency.disabled = !controls.incident.checked;
    controls.incidentSeverity.disabled = !controls.incident.checked;
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
    importScenario.textContent = t("importScenario");
    exportCsv.textContent = t("exportCsv");
    captureBaseline.textContent = t("captureBaseline");
    renderComparison(simulation.getMetrics());
  }

  function writeScenarioOutput() {
    const data = simulation.serializeScenario();
    const json = JSON.stringify(data, null, 2);
    scenarioOutput.value = json;
    return json;
  }

  function clearScenarioOutput() {
    scenarioOutput.value = "";
    scenarioMessage.textContent = "";
  }

  function downloadText(text, filename, type) {
    const blob = new Blob([text], { type });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function syncControlsFromConfig(config) {
    for (const [key, input] of Object.entries(controls)) {
      if (!Object.prototype.hasOwnProperty.call(config, key)) continue;
      if (input.type === "checkbox") input.checked = Boolean(config[key]);
      else input.value = String(config[key]);
    }
    committedSeed = normalizeSeed(config.seed);
    seedControl.value = committedSeed;
    updateOutputs();
  }

  function importScenarioJson(json) {
    try {
      const scenario = JSON.parse(json);
      const snapshot = simulation.restoreScenario(scenario);
      syncControlsFromConfig(snapshot.config);
      pausedSnapshot = running ? null : snapshot;
      scenarioOutput.value = JSON.stringify(simulation.serializeScenario(), null, 2);
      scenarioMessage.textContent = t("importSuccess");
      loopError = false;
      draw(snapshot);
    } catch (error) {
      console.error("Scenario import error:", error);
      scenarioMessage.textContent = t("importError");
    }
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
      downloadText(json, `traffic-scenario-${seedForFilename(committedSeed)}.json`, "application/json");
    });
    importScenario.addEventListener("click", () => {
      if (scenarioOutput.value.trim()) importScenarioJson(scenarioOutput.value);
      else scenarioFile.click();
    });
    scenarioFile.addEventListener("change", async () => {
      const file = scenarioFile.files && scenarioFile.files[0];
      if (file) importScenarioJson(await file.text());
      scenarioFile.value = "";
    });
    exportCsv.addEventListener("click", () => {
      downloadText(simulation.exportMetricsCsv(), `traffic-metrics-${seedForFilename(committedSeed)}.csv`, "text/csv;charset=utf-8");
    });
    captureBaseline.addEventListener("click", () => {
      baselineMetrics = Object.assign({}, simulation.getMetrics());
      scenarioMessage.textContent = t("baselineSaved");
      renderComparison(simulation.getMetrics());
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

    if (snapshot.config.pedestrianPhase) {
      drawPedestrianCrossing(Boolean(signal.pedestrian), snapshot.time);
    }

    drawIncident(snapshot);
  }

  function drawHighway(snapshot) {
    const highway = layout.highway;
    context.fillStyle = "#26323f";
    context.fillRect(0, highway.roadY, logicalWidth, highway.roadHeight);
    if (snapshot.config.rampMerge) {
      context.strokeStyle = "#26323f";
      context.lineWidth = 54;
      context.beginPath();
      context.moveTo(0, 438);
      context.bezierCurveTo(150, 438, 285, 380, 430, 306);
      context.stroke();
      context.strokeStyle = "#f8d96a";
      context.lineWidth = 3;
      context.setLineDash([18, 18]);
      context.beginPath();
      context.moveTo(0, 438);
      context.bezierCurveTo(150, 438, 285, 380, 430, 306);
      context.stroke();
      context.setLineDash([]);
    }
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
    drawIncident(snapshot);
  }

  function drawIncident(snapshot) {
    const incidents = snapshot.incidents || (snapshot.incident.active ? [snapshot.incident] : []);
    for (const incident of incidents) drawSingleIncident(snapshot, incident);
  }

  function drawSingleIncident(snapshot, incident) {
    const route = window.TrafficSimulatorLib.ROAD_MODEL.routes[snapshot.config.mode][incident.direction];
    const offsets = window.TrafficSimulatorLib.ROAD_MODEL.laneOffsets[snapshot.config.mode][incident.direction];
    if (!route || !offsets) return;
    const lateral = route.fixed + offsets[incident.lane];
    const length = incident.length || 58;
    const thickness = 34;
    const x = route.axis === "x" ? incident.position - length / 2 : lateral - thickness / 2;
    const y = route.axis === "x" ? lateral - thickness / 2 : incident.position - length / 2;
    const width = route.axis === "x" ? length : thickness;
    const height = route.axis === "x" ? thickness : length;
    context.save();
    context.fillStyle = incident.permanent ? "#ca8a04" : (incident.severity === "major" ? "#dc2626" : "#f97316");
    context.fillRect(x, y, width, height);
    context.fillStyle = "#fff7ed";
    context.font = "700 13px system-ui";
    context.fillText(t(incident.permanent ? "roadWork" : "incident"), x + 4, y + Math.min(height - 5, 20), width - 8);
    context.restore();
  }

  function drawPedestrianCrossing(active, time) {
    context.save();
    context.fillStyle = active ? "#f8fafc" : "rgba(248,250,252,0.45)";
    for (let offset = 0; offset < 112; offset += 14) {
      context.fillRect(505 + offset, 280, 8, 14);
      context.fillRect(505 + offset, 428, 8, 14);
    }
    if (active) {
      const walkingOffset = (time * 18) % 110;
      context.fillStyle = "#16a34a";
      context.beginPath();
      context.arc(505 + walkingOffset, 286, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
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
      const redLightViolation = Number(vehicle.redLightViolationUntil) > snapshot.time;
      const angle = directionAngles[vehicle.headingDirection || vehicle.direction];
      if (angle === undefined) {
        throw new Error(`Unknown vehicle direction: ${vehicle.direction}`);
      }
      context.rotate(angle);
      context.fillStyle = vehicle.crashed
        ? "#991b1b"
        : (redLightViolation
          ? "#facc15"
        : (vehicle.isEmergency
          ? "#f8fafc"
        : (vehicle.braking
          ? "#f97316"
          : (vehicle.isBus ? (vehicle.waiting ? "#0369a1" : "#38bdf8") : (vehicle.waiting ? "#f97316" : "#e5e7eb")))));
      context.strokeStyle = redLightViolation ? "#dc2626" : (vehicle.isBus ? "#075985" : "#334155");
      context.lineWidth = 2;
      context.beginPath();
      roundRect(context, -vehicle.length / 2, -10, vehicle.length, 20, 5);
      context.fill();
      context.stroke();
      context.fillStyle = "#111827";
      context.fillRect(vehicle.length / 2 - 7, -5, 4, 10);
      if (vehicle.isEmergency) {
        context.fillStyle = Math.floor(snapshot.time * 5) % 2 ? "#2563eb" : "#dc2626";
        context.fillRect(-5, -9, 10, 3);
      }
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
    const now = performance.now();
    if (now - lastReportUpdate > 500) {
      updateReports(snapshot);
      lastReportUpdate = now;
    }
  }

  function signedDelta(value) {
    const rounded = Math.round(value);
    return `${rounded >= 0 ? "+" : ""}${rounded}`;
  }

  function renderComparison(current) {
    if (!baselineMetrics) {
      comparisonSummary.textContent = t("baselineEmpty");
      return;
    }
    comparisonSummary.textContent = t("comparison")
      .replace("{speed}", `${signedDelta(current.averageSpeedKmh - baselineMetrics.averageSpeedKmh)} ${t("unitKmh")}`)
      .replace("{queue}", signedDelta(current.queueLength - baselineMetrics.queueLength))
      .replace("{trips}", signedDelta(current.completedTrips - baselineMetrics.completedTrips));
  }

  function eventLabel(event) {
    if (event.type.startsWith("incident-start")) return t("eventIncidentStart");
    if (event.type.startsWith("incident-clear")) return t("eventIncidentClear");
    if (event.type === "collision") return t("eventCollision");
    if (event.type === "collision-clear") return t("eventCollisionClear");
    if (event.type.startsWith("lane-change")) return t("eventLaneChange");
    if (event.type === "ramp-entry") return t("eventRampEntry");
    if (event.type === "ramp-merge") return t("eventRampMerge");
    if (event.type === "red-light-run") return t("eventRedLightRun");
    return event.type;
  }

  function drawMetricsChart(history) {
    if (!metricsChartContext) return;
    const ctx = metricsChartContext;
    const width = metricsChart.width;
    const height = metricsChart.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    for (let y = 25; y < height - 20; y += 35) {
      ctx.beginPath();
      ctx.moveTo(34, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    }
    if (!history.length) return;
    const samples = history.slice(-120);
    const maxSpeed = Math.max(10, ...samples.map((sample) => sample.averageSpeedKmh));
    const maxQueue = Math.max(5, ...samples.map((sample) => sample.queueLength));
    const drawSeries = (key, maximum, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      samples.forEach((sample, index) => {
        const x = 34 + index / Math.max(1, samples.length - 1) * (width - 46);
        const y = height - 22 - sample[key] / maximum * (height - 42);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    drawSeries("averageSpeedKmh", maxSpeed, "#0284c7");
    drawSeries("queueLength", maxQueue, "#dc2626");
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#0284c7";
    ctx.fillText(`${t("averageSpeed")} (${t("unitKmh")})`, 38, 15);
    ctx.fillStyle = "#dc2626";
    ctx.fillText(t("queueLength"), width - 105, 15);
  }

  function updateReports(snapshot) {
    drawMetricsChart(snapshot.history || []);
    renderComparison(snapshot.metrics);
    eventLog.replaceChildren();
    const events = (snapshot.events || []).slice(-6).reverse();
    if (!events.length) {
      const item = document.createElement("li");
      item.textContent = t("noEvents");
      eventLog.append(item);
      return;
    }
    for (const event of events) {
      const item = document.createElement("li");
      item.textContent = `${Math.floor(event.time / 60)}:${String(Math.floor(event.time % 60)).padStart(2, "0")} ${eventLabel(event)}`;
      eventLog.append(item);
    }
  }

  function formatIncidentCountdown(seconds) {
    const totalSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    if (minutes === 0) return `${remainingSeconds} ${t("unitSec")}`;
    if (remainingSeconds === 0) return `${minutes} ${t("unitMin")}`;
    return `${minutes} ${t("unitMin")} ${remainingSeconds} ${t("unitSec")}`;
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
        "{time}",
        formatIncidentCountdown(data.incidentRemainingSeconds)
      );
    } else if (data.nextIncidentSeconds !== null) {
      metrics.incidentStatus.textContent = t("incidentScheduled").replace(
        "{time}",
        formatIncidentCountdown(data.nextIncidentSeconds)
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
        simulationDebtSeconds = Math.min(3, simulationDebtSeconds + dt * Number(simulationSpeedControl.value));
        let substeps = 0;
        while (simulationDebtSeconds > 0 && substeps < 120) {
          const stepSeconds = Math.min(window.TrafficSimulatorLib.MAX_STEP_SECONDS, simulationDebtSeconds);
          snapshot = simulation.step(stepSeconds);
          simulationDebtSeconds -= stepSeconds;
          substeps += 1;
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
