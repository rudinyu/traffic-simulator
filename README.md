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
- Physics-based acceleration, braking distance, lane following, and collision response.
- Two lanes per direction with predictive collision avoidance and intersection clearance phases.
- Live average speed, vehicle count, queue length, and completed trip metrics.

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
- 使用物理式加速度、煞車距離、跟車安全距離與碰撞反應。
- 每個方向兩條車道，具備碰撞預測與路口清空號誌階段。
- 可啟用事故瓶頸與公車號誌優先情境。
- 即時顯示平均速度、網路車輛數、排隊長度與完成旅次。

網站支援 English / 繁體中文切換，語言偏好會保存在瀏覽器中。

公開網站：

<https://rudinyu.github.io/traffic-simulator/>

本機使用：直接用瀏覽器開啟 `index.html`。
