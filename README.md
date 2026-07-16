# Traffic Simulator

## English

An interactive browser-based traffic simulator for studying how signal timing,
traffic demand, speed limits, incident bottlenecks, and bus priority affect
intersection congestion, highway flow, throughput, and delayed braking.

## Features

- Real-time Canvas visualization of four-way intersection traffic.
- Adjustable traffic demand, speed limit, signal cycle, and green split.
- Optional incident bottleneck and bus signal priority scenarios.
- Highway mode with opposing traffic streams and no intersection signals.
- Adjustable driver reaction time and brake build-up time to study braking delay.
- Road-condition presets for dry, wet, and icy pavement with friction-limited acceleration and braking.
- Per-vehicle driver profiles that vary reaction time, desired headway, acceleration, and braking capability.
- Physics-based acceleration, braking distance, lane following, lane changing, and collision response.
- Two lanes per direction with predictive collision avoidance and intersection clearance phases.
- Shared roadway data model used by both the simulation engine and Canvas renderer.
- Reproducible scenario seeds and JSON snapshot export for demos, reports, and regression checks.
- Live average speed, vehicle count, queue length, and completed trip metrics.

## Commercialization Gaps

The simulator is ready for free public demos, but a commercial-grade product would still need:

- Import/export for real road networks such as GeoJSON, OpenStreetMap, or GIS lane geometry.
- Scenario comparison reports with charts, run history, and downloadable summaries.
- Calibrated driver-behavior presets based on measured traffic counts or field observations.
- More maneuvers: turning movements, merging ramps, lane closures, emergency vehicles, and pedestrian phases.
- Larger-network performance work, including spatial indexing for collision and leader lookup.
- Validation datasets and accuracy notes so users understand model limits.
- Project storage, sharing, and access control if scenarios are saved online.

## Live Demo

Run it on GitHub Pages:

<https://rudinyu.github.io/traffic-simulator/>

## Local Usage

Open `index.html` directly in a browser.

Development and CI checks:

```bash
npm test
npm run build
npm run check
```

## 繁體中文

互動式瀏覽器交通模擬器，可研究號誌時序、交通需求、速限、事故瓶頸、公車優先、高速公路車流與煞車遞延效應。

功能包含：

- 四向路口與雙向高速公路 Canvas 即時視覺化。
- 可調整交通需求、速限、號誌週期與綠燈比例。
- 高速公路模式可調整駕駛反應時間與煞車建立時間。
- 支援乾燥、濕滑、結冰路面，會影響摩擦限制下的加速與煞車。
- 每台車有駕駛者差異，會影響反應時間、跟車距離、加速與煞車能力。
- 使用物理式加速度、煞車距離、跟車安全距離、換道與碰撞反應。
- 每個方向兩條車道，具備碰撞預測與路口清空號誌階段。
- 模擬核心與 Canvas 畫面共用同一份道路資料模型，降低道路切割錯位。
- 支援情境 seed 與 JSON 快照匯出，方便重現 demo、報告與回歸測試。
- 可啟用事故瓶頸與公車號誌優先情境。
- 即時顯示平均速度、網路車輛數、排隊長度與完成旅次。

網站支援 English / 繁體中文切換，語言偏好會保存在瀏覽器中。

公開網站：

<https://rudinyu.github.io/traffic-simulator/>

本機使用：直接用瀏覽器開啟 `index.html`。

商業化還需要補強：

- 匯入真實道路網，例如 GeoJSON、OpenStreetMap 或 GIS 車道幾何。
- 情境比較報表、圖表、歷史紀錄與可下載摘要。
- 依實測交通量或現場觀察校準駕駛行為參數。
- 更多交通行為：轉向、匝道匯入、車道封閉、緊急車輛與行人時相。
- 大型路網效能優化，例如碰撞與前車搜尋的空間索引。
- 驗證資料集與模型限制說明，讓使用者知道模擬可信範圍。
- 若要線上儲存情境，需加入專案儲存、分享與權限控管。
