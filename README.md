# Traffic Simulator

An interactive browser-based traffic simulator for studying how signal timing,
traffic demand, speed limits, incident bottlenecks, and bus priority affect
intersection congestion and throughput.

## Features

- Real-time Canvas visualization of four-way intersection traffic.
- Adjustable traffic demand, speed limit, signal cycle, and green split.
- Optional incident bottleneck and bus signal priority scenarios.
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
