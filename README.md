# Traffic Simulator

## English

An interactive browser-based traffic simulator for studying how signal timing,
traffic demand, speed limits, incident bottlenecks, and bus priority affect
intersection congestion, highway flow, throughput, and delayed braking.

## Features

- Real-time Canvas visualization of four-way intersection traffic.
- Adjustable traffic demand, speed limit, signal cycle, and green split.
- Seeded random incidents with automatic 30–120 simulated-minute clearance and repeat scheduling.
- Highway mode with opposing traffic streams and no intersection signals.
- Adjustable driver reaction time and brake build-up time to study braking delay.
- Road-condition presets for dry, wet, and icy pavement with friction-limited acceleration and braking.
- Per-vehicle driver profiles that vary reaction time, desired headway, acceleration, and braking capability.
- Human-like lane-change behavior with perception delay, gap acceptance, turn signals, cooldowns, and smooth multi-second trajectories.
- Mid-maneuver gap reassessment, safe lane-change aborts, emergency-vehicle yielding, and incident avoidance.
- Physics-based acceleration, braking distance, lane following, and mass-weighted post-impact momentum with frictional settling.
- Two lanes per direction with predictive collision avoidance and intersection clearance phases.
- Turning traffic, pedestrian all-red phases, highway ramp merging, and persistent work-zone lane closures.
- Shared roadway data model used by both the simulation engine and Canvas renderer.
- Exact JSON state export/import, including random-generator state, active vehicles, incidents, events, and metric history.
- Live time-series charts, event history, CSV export, and baseline comparison.
- Spatial-grid collision candidate indexing and a bounded 60x simulation frame budget.
- 1x, 10x, and 60x simulation speeds for observing long incident lifecycles.
- Desktop and mobile browser regression tests in GitHub Actions.

## Commercialization Gaps

The simulator is ready for free public use and reproducible experiments. A production service would still need:

- Import/export for real road networks such as GeoJSON, OpenStreetMap, or GIS lane geometry.
- Calibrated driver-behavior presets based on measured traffic counts or field observations.
- Multi-link route assignment and leader indexing for city-scale networks; the current model is a single intersection or highway segment.
- Validation datasets and calibrated accuracy bounds; current outputs are comparative, not engineering certification.
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
npm run test:e2e
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
- 換道包含駕駛察覺延遲、前後車距判斷、方向燈、冷卻時間與 2–4 秒平滑橫移。
- 換道途中會重新檢查前後車距，空間不足時會安全中止；一般車輛也會避讓緊急車輛。
- 碰撞依車重與速度保留撞擊後動量，再透過摩擦逐步停止，不會立即消失或穿越障礙物。
- 每個方向兩條車道，具備碰撞預測與路口清空號誌階段。
- 支援轉向車流、行人全紅時相、高速公路匝道匯入與施工封道。
- 模擬核心與 Canvas 畫面共用同一份道路資料模型，降低道路切割錯位。
- 支援情境 seed 與完整 JSON 狀態匯出/匯入，可精確還原車輛、亂數狀態、事故、事件與指標歷史。
- 可啟用依 Seed 重現的隨機事故；事故會在模擬時間 30–120 分鐘後自動解除並排定下一次事件。
- 支援 1x、10x、60x 模擬速度，方便觀察長時間事故生命週期。
- 提供時間序列圖、事件紀錄、CSV 匯出與基準情境比較。
- 使用空間網格縮小碰撞候選範圍，並限制高速模擬每幀運算量。

網站支援 English / 繁體中文切換，語言偏好會保存在瀏覽器中。

公開網站：

<https://rudinyu.github.io/traffic-simulator/>

本機使用：直接用瀏覽器開啟 `index.html`。

若要成為正式線上服務，仍需補強：

- 匯入真實道路網，例如 GeoJSON、OpenStreetMap 或 GIS 車道幾何。
- 依實測交通量或現場觀察校準駕駛行為參數。
- 城市級多路段路徑分派與前車索引；目前模型範圍是單一路口或單一高速公路路段。
- 驗證資料集、校準流程與誤差範圍；目前數值適合比較情境，不可當作工程認證結果。
- 若要線上儲存情境，需加入專案儲存、分享與權限控管。
