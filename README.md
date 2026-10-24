# FuzzyABR

A fuzzy-logic adaptive bitrate (ABR) controller for video streaming. Every 3 seconds it takes the network's bandwidth, the player's buffer health and the network delay, and decides which video quality to play, using a Mamdani fuzzy inference system. The decision drives a real multi-bitrate HLS stream in the browser.

<!-- will add a screenshot or GIF here: ![FuzzyABR demo](docs/demo.gif) -->

## How it works

```
React client (:3000)  ──POST /api/network-status──▶  Express server (:8000)  ──POST /get-quality──▶  Flask engine (:5001)
  hls.js player                                       logging + fallback                              scikit-fuzzy (Mamdani)
  charts, QoE score                                   ◀── quality (p) ──                              ◀── quality (p) ──
```

| Folder | Role |
|---|---|
| `client/` | React app. Plays an HLS stream with hls.js, polls the controller every 3s, switches quality levels, shows a live network chart, decision history and QoE score. |
| `server/` | Node/Express middle tier. Proxies requests to the engine, logs every decision to `requests.log`, and falls back gracefully if the engine is unreachable. |
| `engine/` | Python/Flask service wrapping the fuzzy inference system (`fuzzy_engine.py`): bandwidth, buffer and delay in, quality out. |

### The fuzzy engine
Three inputs (bandwidth in Mbps, buffer in seconds, delay in ms) are fuzzified with membership functions, combined through a rule base, and defuzzified into a single quality value in the 0–1080 range. The client maps that value to the closest available HLS level.

### Modes
- **Manual** (default): bandwidth and delay are set with sliders so specific scenarios can be tested.
- **Real Network**: bandwidth and delay come from the browser's `navigator.connection` readings. This is supported in Chrome and Edge, not Firefox or Safari.
- **Buffer**: read live from the video element's buffered range.

### QoE score
A rolling 0–100 score over the last 10 decisions: average quality, minus a penalty per quality switch, minus a penalty for low buffer. This is a custom heuristic inspired by standard QoE factors, not a validated model such as ITU-T P.1203.

## Run it

### Docker (recommended)
```bash
docker compose up --build
```
Then open the client URL from the compose file (default http://localhost:3000).

### Without Docker
```bash
# 1. Engine
cd engine
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py            # :5001

# 2. Server (new terminal)
cd server
npm install
node index.js            # :8000

# 3. Client (new terminal)
cd client
npm install
npm start                # :3000
```

Health checks: `curl localhost:5001/health` and `curl localhost:8000/api/health`.

## Limitations
- Real Network mode relies on `navigator.connection`, which is coarse and Chrome/Edge only. It is not a measured throughput probe.
- Uses a public multi-bitrate test stream rather than self-encoded content.
- The QoE weights are hand-picked.

## Stack
React, hls.js, Node/Express, Python/Flask, scikit-fuzzy, Docker.
