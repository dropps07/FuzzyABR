# FuzzyABR

A fuzzy-logic adaptive bitrate (ABR) controller that picks video quality the way a human would — by reasoning about bandwidth, buffer and delay, not hard thresholds.

**Live demo → [fuzzyabr-client.onrender.com](https://fuzzyabr-client.onrender.com)**

Instead of switching quality on fixed bandwidth thresholds, a Mamdani fuzzy inference engine (scikit-fuzzy) weighs three live signals — bandwidth, buffer health and network delay — against seven rules, and defuzzifies them into a quality between 144p and 1080p. A React dashboard shows the reasoning live: membership bars, which rules fired, a quality ladder, scenario presets, and a Real Network mode that reads your actual connection. The stream is Red Bull TV over HLS (hls.js).

---

# Dashboard
<img width="2904" height="1412" alt="image" src="https://github.com/user-attachments/assets/3b1e46ba-3c10-404d-89d6-45779b29e3c9" />

# Stats
<img width="1043" height="707" alt="Screenshot 2026-11-15 at 1 54 50 AM" src="https://github.com/user-attachments/assets/ef88a37b-cf24-427c-b270-0587d9c8e430" />

---

## How it works

Every 3 seconds the client samples the network, asks the engine for a quality, and switches the HLS level to match:

```
Video element (hls.js, Red Bull TV)
  │  live buffer (s) + bandwidth / delay (sliders or navigator.connection)
  ▼
[1] Client polls                    — POST /api/network-status every 3s
  │
  ▼
[2] Express server (proxy)          — 2s timeout to the engine, logs every
                                      decision to server/requests.log
  │
  ▼
[3] Flask fuzzy engine              — Mamdani inference, 3 inputs → 1 quality
  │                                   (scikit-fuzzy, centroid defuzzification)
  ▼
[4] Client maps quality → level     — closest HLS level by height,
                                      switches via hls.js, records the decision
```

If the engine is unreachable, the server answers with a 360 fallback labelled `source: 'fallback'` — the player never stalls on a missing backend, and the dashboard says so honestly instead of faking a decision.

---

## The fuzzy model

Everything below is the model as it runs in `engine/fuzzy_engine.py`. The dashboard mirrors it in-browser (`client/src/utils/fuzzy.js`) so the rule board can show live firing strengths without a round trip.

### Inputs and membership functions

| Input | Range | Labels |
|---|---|---|
| Bandwidth | 0–16 Mbps | low `trapmf [0, 0, 2, 4]` · medium `trimf [3, 5, 7]` · high `trimf [6, 8, 11]` · excellent `trapmf [10, 13, 16, 16]` |
| Buffer | 0–30 s | draining `trapmf [0, 0, 3, 8]` · healthy `trimf [5, 14, 22]` · full `trapmf [18, 25, 30, 30]` |
| Delay | 0–400 ms | low `trapmf [0, 0, 50, 100]` · high `trapmf [90, 150, 400, 400]` |

Two details are deliberate, not accidental:

- **Delay `high` starts at 90 ms, overlapping `low` (which ends at 100 ms).** There is no hole at 100 ms where neither label applies — every delay value belongs to at least one label.
- **The output sets overlap the same way.** Panic `[144, 144, 280]`, low `[240, 400, 560]`, medium `[480, 700, 880]`, high `[800, 1080, 1080]` — adjacent sets share edges, so the centroid moves smoothly instead of jumping.

### The 7 rules

AND is `min`; OR is `max`. The first three are safety overrides — they fire on a single bad signal, whatever else looks good.

| # | Rule | Output |
|---|---|---|
| A | IF delay is high | panic |
| B | IF buffer is draining | low |
| C | IF bandwidth is low | low |
| D | IF bandwidth is medium AND (buffer is healthy OR full) | medium |
| E | IF bandwidth is high AND buffer is healthy | medium |
| F | IF bandwidth is high AND buffer is full | high |
| G | IF bandwidth is excellent AND (buffer is healthy OR full) | high |

Note what rule F says: high bandwidth alone is **not** enough for top quality — the buffer has to be full too. A healthy buffer caps high bandwidth at medium. That is the model's conservatism, and it is the rule most worth demonstrating.

### Worked examples

Computed from the membership functions above; the quality is the centroid of the fully activated consequent set. The two starred values match the live demo.

| Input (bandwidth, buffer, delay) | Rules fired (strength) | Quality |
|---|---|---|
| 16 Mbps, 30 s, 0 ms | G excellent & (healthy\|full) → high @ 1.00 | ≈ 987 → 1080p |
| 2 Mbps, 5 s, 250 ms | A delay high → panic @ 1.00; B draining → low @ 0.60; C bandwidth low → low @ 1.00 | panic / low, well under 300 |
| 5 Mbps, 14 s, 60 ms | D medium & (healthy\|full) → medium @ 1.00 | ≈ 687 → 720p |
| 8 Mbps, 30 s, 60 ms | F high & full → high @ 1.00 | ≈ 987 → 1080p |

The 8 Mbps row is the interesting one: the engine fires exactly one rule and returns top quality — while the dashboard's rule board can show "0 of 6 fired" for the same input (see [Known limitations](#known-limitations)).

### What the design reveals

**The delay override dominates everything.** Rule A has no other conditions: at 250 ms delay the engine pulls quality to panic even with 16 Mbps and a full buffer. The engine test pins this down — `decide(16, 30, 300) < 300`. For a player, a stalled stream is worse than a soft one, so delay gets a veto.

**There are no coverage gaps.** `find_gaps()` grid-scans the whole input space (bandwidth 0–16, buffer 0–30, delay 0–400) and finds zero combinations where no rule fires. A `decide()` that returns `None` is therefore never a model hole — it can only mean the engine itself failed, which is exactly when the 360 fallback is the right answer.

**Quality is monotonic in bandwidth.** The engine test asserts it: holding buffer at 30 s and delay at 0, quality never drops as bandwidth rises (within rounding). A controller that gets *worse* as the network improves would be a bug; here it is a tested property.

**The output is smooth, not stepped.** Because the result is a centroid over clipped consequents, a small change in bandwidth moves quality a little — it never jumps a whole level at an invisible threshold. That is the entire point of doing this with fuzzy logic instead of `if bandwidth > 8: 1080p`. A crisp controller flaps at its boundaries; this one glides.

---

## The dashboard

- **Why this quality?** — live membership bars for all three inputs, the rule board showing which rules fired and how strongly, and a **collected-rules checklist**: rules you trigger by moving the sliders accumulate with a ✓, so an interviewer can see the board fill up as they test it. (In-memory; resets on refresh.)
- **Quality ladder** — every HLS level with its bitrate, the current level highlighted, and the fuzzy decision mapped to the closest level by height.
- **Scenario presets** — Good Wi-Fi (14 Mbps / 30 ms), Congested café (4 / 180), Flaky 4G (3 / 250), Buffer starving (6 / 90, manual buffer 2 s), plus manual sliders for all three inputs.
- **Real Network mode** — bandwidth and delay come from the browser's `navigator.connection` (Chrome/Edge only). Buffer is always read live from the video element.
- **Quality-over-time chart, decision history, QoE score** — a rolling 0–100 score over the last 10 decisions: average quality, minus a penalty per quality switch, minus a penalty for low buffer. This is a custom heuristic inspired by standard QoE factors, **not** a validated model such as ITU-T P.1203.
- **Now playing pill** — a liquid-glass status pill under the video showing the current level (`Now playing: 720p`), display only.

---

## Stack

| Layer | Technology |
|---|---|
| Fuzzy engine | [scikit-fuzzy](https://github.com/scikit-fuzzy/scikit-fuzzy) (Mamdani) + Flask, Python 3.11 |
| Server | Express 5 + axios (proxy, 2 s engine timeout, request log) |
| Client | React 19, [hls.js](https://github.com/video-dev/hls.js) 1.7, Recharts 3, Create React App |
| Stream | Red Bull TV live HLS — 6 variants, 180p–1080p, CORS open |
| Deployment | Render Blueprint — engine + server as Docker web services, client as a static site |

---

## Project structure

```
FuzzyABR/
├── client/                  # React dashboard (CRA)
│   └── src/
│       ├── App.jsx               # layout: video + decision, ladder, simulate, chart
│       ├── App.css               # reticia theme: pure black, minimal white type
│       ├── api/abrClient.js      # server URL from REACT_APP_SERVER_URL (localhost fallback)
│       ├── hooks/useAbrEngine.js # 3s poll loop, history, QoE
│       ├── utils/
│       │   ├── fuzzy.js          # in-browser mirror of memberships + rules
│       │   ├── qoe.js            # QoE heuristic
│       │   └── buffer.js         # live buffer reading
│       └── components/
│           ├── VideoPlayer.jsx   # hls.js, level switching, now-playing pill
│           ├── FuzzyPanel.jsx    # membership bars + rule board + checklist
│           ├── QualityLadder.jsx # HLS levels + bitrates
│           └── NetworkChart.jsx  # quality / bandwidth / buffer / delay over time
├── server/                  # Express proxy
│   ├── index.js             # POST /api/network-status, GET /api/health
│   └── requests.log         # one JSON line per decision
├── engine/                  # Flask + scikit-fuzzy
│   ├── app.py               # POST /get-quality, POST /api/network-status,
│   │                        # GET /health, GET /rules
│   ├── fuzzy_engine.py      # memberships, 7 rules, decide(), find_gaps()
│   └── tests/test_engine.py # pytest: no gaps, monotonicity, delay veto
├── docker-compose.yml       # engine :5001, server :8000, client :3000
└── render.yaml              # Render Blueprint (3 services)
```

---

## API reference

| Route | Method | Notes |
|---|---|---|
| `/get-quality` (engine `:5001`) | POST | `{bandwidth, buffer, delay}` → `{quality, source, inputs}`. Inputs are clipped to their ranges; 400 on bad input. No rule fired → quality 360, `source: 'fallback'`. |
| `/api/network-status` (engine `:5001`) | POST | Same inference behind the server's path. |
| `/health` (engine `:5001`) | GET | `{"status": "ok"}` |
| `/rules` (engine `:5001`) | GET | The rule base, for inspection. |
| `/api/network-status` (server `:8000`) | POST | Proxies to the engine with a 2 s timeout; engine unreachable → 360 fallback, `source: 'fallback'`. |
| `/api/health` (server `:8000`) | GET | `{"server": "ok", "fuzzy_engine": "ok" \| "unreachable"}` |

---

## Running locally

**Prerequisites:** Docker, or Python 3.11 + Node 20+

### Docker (recommended)

```bash
docker compose up -d --build
```

Then open `http://localhost:3000`. Run it one way at a time — Docker **or** manual, not both: a stray manual engine on `:8000` will fight the container for the port.

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

### Tests

```bash
cd engine && python -m pytest        # 3 tests: no coverage gaps,
                                     # quality monotonic in bandwidth,
                                     # high delay forces quality < 300
cd ../client && npm run build        # production build (warning-free)
```

---

## Deployment

Render, from `render.yaml` (New → Blueprint → pick this repo). Three services:

- **fuzzyabr-engine** — Docker web service, `HOST=0.0.0.0`, port from `PORT`.
- **fuzzyabr-server** — Docker web service, `FUZZY_ENGINE_URL=https://fuzzyabr-engine.onrender.com`.
- **fuzzyabr-client** — static site, `REACT_APP_SERVER_URL=https://fuzzyabr-server.onrender.com` (inlined into the bundle at **build** time — changing it later needs a rebuild).

Two gotchas worth knowing if you redeploy elsewhere:

- **Static sites take no `plan` in `render.yaml`.** Only the Docker web services do — a `plan: free` on the static site fails validation.
- **Render's Docker build context defaults to the repo root**, while the Dockerfiles expect their own folder (`COPY requirements.txt .`). `render.yaml` sets `dockerContext: ./engine` and `./server` so the builds match `docker-compose` exactly.

Free-tier caveat: the two web services sleep after 15 minutes with no traffic. The first visit after a sleep takes ~30–60 s to wake up — the page loads, the engine badge reads "Engine unreachable" and quality sits on the 360 fallback until the engine answers, then it behaves normally. The static site never sleeps.

---

## Known limitations

- **The in-browser rule mirror is out of sync with the engine.** `client/src/utils/fuzzy.js` lists 6 rules; the engine runs 7. The mirror's rules D–F add a "delay is low" condition the engine doesn't have, and it is missing the "high bandwidth + full buffer → high" rule entirely. So the rule board can show "0 of 6 fired" while the engine returns ~987 (see the 8 Mbps worked example). The engine is the source of truth; the mirror needs syncing to 7 rules.
- **QoE is a hand-picked heuristic**, not a validated model. Treat the 0–100 score as a demo signal, not a measurement.
- **Real Network mode is coarse and Chrome/Edge only** — `navigator.connection` reports a bucketed effective type, not a measured throughput probe.
- **The stream is a third-party live channel.** Red Bull TV's HLS URL is public and verified working, but if it moves, the demo stream breaks. The player shows a plain "Stream unavailable" state when it does.

---

## Roadmap

What would take this from a strong demo to a 10/10 project:

1. **Sync the rule mirror to the engine's 7 rules** — one fix, and the board stops lying about the 8 Mbps case.
2. **A real evaluation.** Replay recorded network traces (e.g. FCC Measuring Broadband America, or a throttled local capture) through both the fuzzy controller and a throughput-based baseline (BOLA / naive bitrate ladder) and compare stall rate, switch count and average quality. Numbers beat adjectives.
3. **Validate the QoE score** against ITU-T P.1203, or drop the claim and call it a stability indicator.
4. **Deterministic demo mode.** A recorded trace replay, so the dashboard behaves identically every time instead of depending on a live channel and the visitor's network.
5. **Persist the checklist.** Collected rules in `localStorage`, so the board survives a refresh.
6. **Server and client tests.** The engine has pytest; the proxy and the level-switching logic have none yet.
