import { useCallback, useEffect, useState, useRef } from 'react';
import VideoPlayer from './components/VideoPlayer';
import NetworkChart from './components/NetworkChart';
import FuzzyPanel from './components/FuzzyPanel';
import QualityLadder from './components/QualityLadder';
import { useAbrEngine } from './hooks/useAbrEngine';
import { fetchHealth, wakeEngine } from './api/abrClient';
import { getBufferAhead } from './utils/buffer';
import { computeQoe, qoeClass } from './utils/qoe';
import { closestLevelHeight, fuzzify, evaluateRules } from './utils/fuzzy';
import './App.css';

// One-click network scenarios. Presets always switch back to manual
// sliders — they are hand-picked conditions, not live readings.
const PRESETS = [
  { name: 'Good Wi-Fi', bandwidth: 14, delay: 30 },
  { name: 'Congested café', bandwidth: 4, delay: 180 },
  { name: 'Flaky 4G', bandwidth: 3, delay: 250 },
  { name: 'Buffer starving', bandwidth: 6, delay: 90, buffer: 2 },
];

function App() {
  const [bandwidth, setBandwidth] = useState(8);
  const [delay, setDelay] = useState(60);
  const [buffer, setBuffer] = useState(15);
  const [bufferMode, setBufferMode] = useState('live'); // 'live' | 'manual'
  const [realNetwork, setRealNetwork] = useState(false);
  const [levels, setLevels] = useState([]);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(null);
  const [health, setHealth] = useState('checking'); // checking | ok | degraded | unreachable
  const [now, setNow] = useState(Date.now());
  const videoRef = useRef(null);

  // Real Network mode: bandwidth/delay come from the browser's
  // navigator.connection readings (Chrome/Edge only) instead of the
  // sliders. Read fresh on every render; the 1s countdown ticker below
  // re-renders App, so the hook's inputs ref stays current and each
  // 3s poll sends a fresh reading. Manual slider values are kept, so
  // toggling back restores them.
  const connection =
    typeof navigator !== 'undefined' ? navigator.connection : undefined;
  const realSupported =
    !!connection && typeof connection.downlink === 'number';
  const effBandwidth =
    realNetwork && realSupported
      ? Math.min(16, Math.max(0, connection.downlink))
      : bandwidth;
  const effDelay =
    realNetwork &&
    realSupported &&
    typeof connection.rtt === 'number'
      ? connection.rtt
      : delay;

  const { decision, source, history } = useAbrEngine({
    bandwidth: effBandwidth,
    delay: effDelay,
    getBuffer: () =>
      bufferMode === 'manual' ? buffer : getBufferAhead(videoRef.current),
  });

  const qoe = computeQoe(history);

  // Inputs that were actually sent on the last poll — what the fuzzy
  // panel visualises. The engine only ever sees these values.
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  const lastInputs = lastEntry
    ? { bandwidth: lastEntry.bandwidth, buffer: lastEntry.buffer, delay: lastEntry.delay }
    : null;

  // Rule checklist: every rule that has fired at least once since the page
  // loaded stays collected, so toggling the settings builds the set up
  // instead of resetting the count. Collection happens on the last POLLED
  // inputs (what the engine actually saw), not the live slider positions —
  // a rule lands in the checklist on the next 3s poll after you move a
  // slider. The checklist is in-memory: it resets on page refresh.
  const [collectedRules, setCollectedRules] = useState(() => new Set());
  useEffect(() => {
    if (!lastEntry) return;
    const fired = evaluateRules(
      fuzzify(lastEntry.bandwidth, lastEntry.buffer, lastEntry.delay)
    )
      .filter((r) => r.strength > 0)
      .map((r) => r.id);
    if (fired.length === 0) return;
    setCollectedRules((prev) => {
      if (fired.every((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      fired.forEach((id) => next.add(id));
      return next;
    });
  }, [lastEntry]);
  const resetCollectedRules = useCallback(() => setCollectedRules(new Set()), []);

  const mappedLevel =
    decision != null
      ? closestLevelHeight(decision, levels.map((lvl) => lvl.height))
      : null;
  const nowPlaying =
    levels.length > 0 && currentLevelIndex !== null
      ? levels[currentLevelIndex]?.height
      : null;

  // Wake the sleeping engine as soon as someone opens the page: one
  // fire-and-forget GET at the engine's /health starts its ~13s wake
  // immediately, instead of waiting for the server's polls (which never
  // wake it on their own). Runs once on mount.
  useEffect(() => {
    wakeEngine();
  }, []);

  // Engine health: on mount and every 30s (via the server's /api/health,
  // which also reports whether the fuzzy engine answers).
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetchHealth();
        if (!cancelled) setHealth(res.fuzzy_engine === 'ok' ? 'ok' : 'degraded');
      } catch {
        if (!cancelled) setHealth('unreachable');
      }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // 1s ticker — drives the next-decision countdown (display only; the
  // poll itself lives in useAbrEngine) and keeps Real Network readings fresh.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const secondsToNext = lastEntry
    ? Math.max(0, 3 - Math.floor((now - lastEntry.t) / 1000))
    : null;

  const handleLevelsChange = useCallback((lvls) => setLevels(lvls), []);
  const handleLevelChange = useCallback((idx) => setCurrentLevelIndex(idx), []);

  const applyPreset = (preset) => {
    setRealNetwork(false);
    setBandwidth(preset.bandwidth);
    setDelay(preset.delay);
    if (preset.buffer !== undefined) {
      setBufferMode('manual');
      setBuffer(preset.buffer);
    }
  };

  const slidersDisabled = realNetwork && realSupported;

  return (
    <div className="App">
      <header className="app-header">
        <div>
          <h1>FuzzyABR</h1>
          <p className="subtitle">A fuzzy-logic bitrate controller, deciding video quality every 3 seconds.</p>
        </div>
        <div className="health-wrap">
          <span className={`health health-${health}`} title="Engine health (server /api/health)">
            <span className="health-dot" />
            {health === 'ok'
              ? 'Engine ok'
              : health === 'degraded'
                ? 'Engine unreachable'
                : health === 'unreachable'
                  ? 'Server unreachable'
                  : 'Checking…'}
          </span>
          {(health === 'checking' || health === 'degraded') && (
            <p className="waking-note">Please wait — the server is waking up (about 13 sec)</p>
          )}
        </div>
      </header>

      <main className="dashboard">
        <section className="player-col">
          <VideoPlayer
            videoRef={videoRef}
            selectedQuality={decision}
            onLevelsChange={handleLevelsChange}
            onLevelChange={handleLevelChange}
          />
        </section>

        <aside className="side-col">
          <div className="decision-panel panel">
            <div className="stat">
              <span className="label">Fuzzy decision</span>
              <span className="value">{decision ? `${Math.round(decision)}` : '…'}</span>
            </div>
            <div className="stat">
              <span className="label">Now playing</span>
              <span className="value">{nowPlaying ? `${nowPlaying}p` : '…'}</span>
            </div>
            <div className="stat">
              <span className="label">Source</span>
              <span className={`value small ${source === 'fallback' ? 'warning' : ''}`}>{source || '…'}</span>
            </div>
            <div className="stat">
              <span className="label">QoE score</span>
              <span className={`value ${qoeClass(qoe)}`}>{qoe === null ? '…' : `${qoe}/100`}</span>
            </div>
            <div className="stat">
              <span className="label">Next decision in</span>
              <span className="value">{secondsToNext === null ? '…' : `${secondsToNext}s`}</span>
            </div>
          </div>

          <QualityLadder
            levels={levels}
            currentLevelIndex={currentLevelIndex}
            decision={decision}
          />
        </aside>
      </main>

      <FuzzyPanel inputs={lastInputs} decision={decision} mappedLevel={mappedLevel} collectedRules={collectedRules} onResetCollected={resetCollectedRules} />

      <div className="simulate-row">
        <section className="controls panel">
        <h3>Simulate network conditions</h3>

        <div className="presets">
          {PRESETS.map((preset) => (
            <button key={preset.name} type="button" onClick={() => applyPreset(preset)}>
              {preset.name}
            </button>
          ))}
        </div>

        <div className="network-mode-toggle">
          <span className="label">Network source</span>
          <button
            type="button"
            className={!realNetwork ? 'active' : ''}
            onClick={() => setRealNetwork(false)}
          >
            Manual sliders
          </button>
          <button
            type="button"
            className={realNetwork ? 'active' : ''}
            onClick={() => setRealNetwork(true)}
          >
            Real network
          </button>
        </div>
        {realNetwork && !realSupported ? (
          <p className="hint">
            Real network isn&apos;t supported in this browser — it needs
            navigator.connection (Chrome/Edge). Using the manual sliders instead.
          </p>
        ) : realNetwork ? (
          <p className="hint">
            Reading bandwidth and delay live from navigator.connection — the
            sliders below are paused while this is on.
          </p>
        ) : null}

        <label>
          Bandwidth: {effBandwidth.toFixed(1)} Mbps
          <input type="range" min="0" max="16" step="0.5" value={bandwidth}
            disabled={slidersDisabled}
            onChange={e => setBandwidth(parseFloat(e.target.value))} />
        </label>
        <label>
          Delay: {Math.round(effDelay)} ms
          <input type="range" min="0" max="400" step="10" value={delay}
            disabled={slidersDisabled}
            onChange={e => setDelay(parseFloat(e.target.value))} />
        </label>

        <div className="buffer-mode-toggle">
          <span className="label">Buffer source</span>
          <button type="button" className={bufferMode === 'live' ? 'active' : ''}
            onClick={() => setBufferMode('live')}>
            Live (from player)
          </button>
          <button type="button" className={bufferMode === 'manual' ? 'active' : ''}
            onClick={() => setBufferMode('manual')}>
            Manual
          </button>
        </div>

        {bufferMode === 'manual' ? (
          <label>
            Buffer: {buffer.toFixed(1)}s
            <input type="range" min="0" max="30" step="0.5" value={buffer}
              onChange={e => setBuffer(parseFloat(e.target.value))} />
          </label>
        ) : (
          <p className="hint">Buffer is read live from the video player.</p>
        )}
        </section>

        <NetworkChart history={history} />
      </div>

      <div className="history panel">
        <h3>Recent decisions</h3>
        <table>
          <thead>
            <tr><th>Time</th><th>Bandwidth</th><th>Buffer</th><th>Delay</th><th>Quality</th></tr>
          </thead>
          <tbody>
            {[...history].reverse().map(h => (
              <tr key={h.id}>
                <td>{new Date(h.t).toLocaleTimeString()}</td>
                <td>{h.bandwidth.toFixed(1)} Mbps</td>
                <td>{h.buffer.toFixed(1)}s</td>
                <td>{h.delay}ms</td>
                <td>{Math.round(h.quality)}p</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="footer">
        <p>FuzzyABR — a fuzzy-logic adaptive bitrate controller · React + hls.js + Flask</p>
      </footer>
    </div>
  );
}

export default App;
