(function runApp() {
  "use strict";

  const translations = {
    en: {
      title: "Traffic Simulation Console", subtitle: "Compare intersection flow with highway traffic and delayed braking effects.",
      language: "Language", pause: "Pause", resume: "Resume", reset: "Reset", metrics: "Live Metrics",
      averageSpeed: "Average Speed", vehiclesInNetwork: "Vehicles in Network", queueLength: "Queue Length", brakingVehicles: "Braking Vehicles", completedTrips: "Completed Trips",
      scenarioControls: "Scenario Controls", roadwayMode: "Roadway Mode", intersection: "Intersection", highway: "Highway",
      trafficDemand: "Traffic Demand", speedLimit: "Speed Limit", signalCycle: "Signal Cycle", greenSplit: "Green Split",
      reactionTime: "Driver Reaction Time", brakeBuildTime: "Brake Build-up Time", incidentBottleneck: "Enable Incident Bottleneck", busPriority: "Bus Signal Priority",
      whatToWatch: "What to Watch", noteCongestion: "Red road segments show congestion, while yellow segments show lower speeds.",
      noteIncident: "The incident bottleneck closes one lane and increases queues.", noteBus: "Bus priority extends the green phase when a bus approaches the intersection.",
      noteBraking: "Highway braking delay combines reaction time with brake build-up time before deceleration begins.", highwayLabel: "HIGHWAY",
      brakingExperiment: "Delayed braking experiment", incident: "Incident", startupTitle: "Traffic simulation failed to start",
      startupDetail: "Make sure the required files loaded, then refresh the page.", loopError: "The simulation hit an error. Press Reset or refresh the page.",
      status: "Average speed {speed} km/h, vehicles in network {vehicles}, queue length {queue}, completed trips {trips}", unitKmh: "km/h", unitSec: "sec"
    },
    "zh-TW": {
      title: "交通模擬控制台", subtitle: "比較路口車流、高速公路車流與煞車遞延效應。", language: "語言", pause: "暫停", resume: "繼續", reset: "重設", metrics: "即時指標",
      averageSpeed: "平均速度", vehiclesInNetwork: "網路車輛數", queueLength: "排隊長度", brakingVehicles: "煞車中車輛", completedTrips: "完成旅次", scenarioControls: "情境控制",
      roadwayMode: "道路模式", intersection: "路口", highway: "高速公路", trafficDemand: "交通需求", speedLimit: "速限", signalCycle: "號誌週期", greenSplit: "綠燈比例",
      reactionTime: "駕駛反應時間", brakeBuildTime: "煞車建立時間", incidentBottleneck: "啟用事故瓶頸", busPriority: "公車號誌優先", whatToWatch: "觀察重點",
      noteCongestion: "紅色路段代表壅塞，黃色路段代表速度較低。", noteIncident: "事故瓶頸會封閉一個車道並增加排隊。",
      noteBus: "公車接近路口時，公車優先會延長綠燈時間。", noteBraking: "高速公路煞車遞延由反應時間與煞車建立時間共同決定。",
      highwayLabel: "高速公路", brakingExperiment: "煞車遞延實驗", incident: "事故", startupTitle: "交通模擬啟動失敗",
      startupDetail: "請確認必要檔案已載入，然後重新整理頁面。", loopError: "模擬發生錯誤，請按重設或重新整理頁面。",
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
    signalCycle: requireElement("signalCycle"),
    greenSplit: requireElement("greenSplit"),
    incident: requireElement("incident"),
    busPriority: requireElement("busPriority"),
    reactionTime: requireElement("reactionTime"),
    brakeBuildTime: requireElement("brakeBuildTime")
  };
  const languageControl = requireElement("language");
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
    completedTrips: requireElement("completedTrips"),
    status: requireElement("trafficStatus")
  };
  const toggleRun = requireElement("toggleRun");
  const resetRun = requireElement("resetRun");
  // Queue-count thresholds used only for visual congestion overlays.
  const congestionOverlayThreshold = 2;
  const congestionHeavyThreshold = 8;
  const directionAngles = {
    east: 0,
    west: Math.PI,
    south: Math.PI / 2,
    north: (3 * Math.PI) / 2
  };

  // Canvas coordinates are pixels in the fixed 1120x720 simulation space.
  // Lane centers and stop lines must stay aligned with ROUTES and STOP_LINES in src/simulation.js.
  const layout = {
    horizontalRoadY: 276,
    verticalRoadX: 476,
    roadWidth: 170,
    centerX: 560,
    centerY: 360,
    intersection: [492, 292, 138, 138],
    signals: [
      [464, 250, "ew"],
      [656, 454, "ew"],
      [438, 450, "ns"],
      [676, 250, "ns"]
    ],
    incident: [742, 306, 58, 34],
    congestionOverlays: {
      east: [120, 296, 380, 48],
      west: [620, 376, 380, 48],
      south: [501, 70, 48, 230],
      north: [571, 420, 48, 230]
    },
    highway: {
      roadY: 234,
      roadHeight: 228,
      dividerY: 348,
      incident: [742, 292, 58, 44],
      congestionOverlays: {
        east: [0, 282, 1120, 48],
        west: [0, 366, 1120, 48]
      },
      labelY: 264,
      footerY: 500
    }
  };

  if (!window.TrafficSimulatorLib || !window.TrafficSimulatorLib.TrafficSimulation) {
    throw new Error("TrafficSimulatorLib failed to load. Check that src/simulation.js is present.");
  }

  const simulation = new window.TrafficSimulatorLib.TrafficSimulation();
  let running = true;
  let lastFrame = performance.now();
  let lastA11yUpdate = 0;
  let pausedSnapshot = null;
  let loopError = false;

  function readConfig() {
    return {
      mode: controls.mode.value,
      demand: Number(controls.demand.value),
      speedLimit: Number(controls.speedLimit.value),
      signalCycle: Number(controls.signalCycle.value),
      greenSplit: Number(controls.greenSplit.value),
      incident: controls.incident.checked,
      busPriority: controls.busPriority.checked,
      reactionTime: Number(controls.reactionTime.value),
      brakeBuildTime: Number(controls.brakeBuildTime.value)
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
    updateOutputs();
    toggleRun.textContent = running ? t("pause") : t("resume");
  }

  function bindControls() {
    languageControl.addEventListener("change", () => applyLanguage(languageControl.value));
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
      });
    }
    toggleRun.addEventListener("click", () => {
      running = !running;
      toggleRun.textContent = running ? t("pause") : t("resume");
      pausedSnapshot = running ? null : simulation.getSnapshot();
      lastFrame = performance.now();
    });
    resetRun.addEventListener("click", () => {
      const wasErrored = loopError;
      simulation.reset(readConfig());
      const snapshot = simulation.getSnapshot();
      running = true;
      toggleRun.textContent = t("pause");
      pausedSnapshot = null;
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
    context.moveTo(layout.centerX, 0);
    context.lineTo(layout.centerX, logicalHeight);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "#111827";
    context.fillRect(...layout.intersection);

    for (const [x, y, axis] of layout.signals) {
      if (signal[axis] === undefined) {
        throw new Error(`Unknown signal axis: ${axis}`);
      }
      drawSignal(x, y, signal[axis] === "green");
    }

    if (snapshot.config.incident) {
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
    context.moveTo(0, highway.dividerY);
    context.lineTo(logicalWidth, highway.dividerY);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#dbeafe";
    context.font = "600 15px system-ui";
    context.fillText(t("highwayLabel"), 24, highway.labelY);
    context.fillText(t("brakingExperiment"), 24, highway.footerY);
    const [incidentX, incidentY, incidentWidth, incidentHeight] = highway.incident;
    if (snapshot.config.incident) {
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
      context.fillStyle = vehicle.braking
        ? "#f97316"
        : (vehicle.isBus ? (vehicle.waiting ? "#0369a1" : "#38bdf8") : (vehicle.waiting ? "#f97316" : "#e5e7eb"));
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
    metrics.completedTrips.textContent = String(data.completedTrips);
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
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      const snapshot = running ? simulation.step(dt) : pausedSnapshot || simulation.getSnapshot();
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
