(function runApp() {
  "use strict";

  // This script relies on the defer attribute in index.html, so the DOM is fully parsed here.
  function renderStartupError() {
    const main = document.createElement("main");
    const title = document.createElement("h1");
    const detail = document.createElement("p");
    main.className = "startup-error";
    title.textContent = "交通模擬無法啟動";
    detail.textContent = "請確認必要檔案已載入後重新整理頁面。";
    main.append(title, detail);
    document.body.replaceChildren(main);
  }

  let startupErrorHandled = false;
  function startupErrorListener(event) {
    if (startupErrorHandled) return;
    const filename = event.filename || "";
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
    demand: requireElement("demand"),
    speedLimit: requireElement("speedLimit"),
    signalCycle: requireElement("signalCycle"),
    greenSplit: requireElement("greenSplit"),
    incident: requireElement("incident"),
    busPriority: requireElement("busPriority")
  };
  const outputs = {
    demand: requireElement("demandOut"),
    speedLimit: requireElement("speedOut"),
    signalCycle: requireElement("cycleOut"),
    greenSplit: requireElement("greenOut")
  };
  const metrics = {
    avgSpeed: requireElement("avgSpeed"),
    vehicleCount: requireElement("vehicleCount"),
    queueLength: requireElement("queueLength"),
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
      demand: Number(controls.demand.value),
      speedLimit: Number(controls.speedLimit.value),
      signalCycle: Number(controls.signalCycle.value),
      greenSplit: Number(controls.greenSplit.value),
      incident: controls.incident.checked,
      busPriority: controls.busPriority.checked
    };
  }

  function updateOutputs() {
    outputs.demand.textContent = `${controls.demand.value}%`;
    outputs.speedLimit.textContent = `${controls.speedLimit.value} km/h`;
    outputs.signalCycle.textContent = `${controls.signalCycle.value} 秒`;
    outputs.greenSplit.textContent = `${controls.greenSplit.value}%`;
  }

  function bindControls() {
    for (const input of Object.values(controls)) {
      input.addEventListener("input", () => {
        updateOutputs();
        simulation.setConfig(readConfig());
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
      toggleRun.textContent = running ? "暫停" : "繼續";
      pausedSnapshot = running ? null : simulation.getSnapshot();
      lastFrame = performance.now();
    });
    resetRun.addEventListener("click", () => {
      const wasErrored = loopError;
      simulation.reset(readConfig());
      const snapshot = simulation.getSnapshot();
      running = true;
      toggleRun.textContent = "暫停";
      pausedSnapshot = null;
      loopError = false;
      lastFrame = performance.now();
      try {
        draw(snapshot);
      } catch (error) {
        loopError = true;
        running = false;
        console.error("Draw error during reset:", error);
        renderLoopError("模擬發生錯誤，請重新整理頁面。");
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
      context.fillText("事故", incidentX + incidentWidth * 0.2, incidentY + incidentHeight * 0.68);
      context.restore();
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
      context.fillStyle = vehicle.isBus
        ? (vehicle.waiting ? "#0369a1" : "#38bdf8")
        : (vehicle.waiting ? "#f97316" : "#e5e7eb");
      context.strokeStyle = vehicle.isBus ? "#075985" : "#334155";
      context.lineWidth = 2;
      context.beginPath();
      roundRect(context, -vehicle.length / 2, -10, vehicle.length, 20, 5);
      context.fill();
      context.stroke();
      context.fillStyle = "#111827";
      context.fillRect(vehicle.length / 2 - 7, -5, 4, 10);
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
    for (const [direction, rect] of Object.entries(layout.congestionOverlays)) {
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
    metrics.avgSpeed.textContent = `${data.averageSpeedKmh} km/h`;
    metrics.vehicleCount.textContent = String(data.vehicleCount);
    metrics.queueLength.textContent = String(data.queueLength);
    metrics.completedTrips.textContent = String(data.completedTrips);
    const now = performance.now();
    if (now - lastA11yUpdate > 1000) {
      metrics.status.textContent = `平均速度 ${data.averageSpeedKmh} km/h，路網車輛 ${data.vehicleCount}，排隊長度 ${data.queueLength}，完成通過 ${data.completedTrips}`;
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
      renderLoopError("模擬發生錯誤，請按重設按鈕或重新整理頁面。");
      return;
    }
    requestAnimationFrame(loop);
  }

  updateOutputs();
  bindControls();
  window.removeEventListener("error", startupErrorListener, true);
  requestAnimationFrame(loop);
})();
