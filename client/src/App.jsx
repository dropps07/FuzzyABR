import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import VideoPlayer from './VideoPlayer';
import './App.css';
import NetworkChart from './NetworkChart';

const SERVER_URL = 'http://127.0.0.1:8000/api/network-status';

function App() {
  const [bandwidth, setBandwidth] = useState(8);
  const [buffer, setBuffer] = useState(15);
  const [bufferMode, setBufferMode] = useState('live'); // 'live' | 'manual'
  const [delay, setDelay] = useState(60);
  const [decision, setDecision] = useState(null);
  const [source, setSource] = useState(null);
  const [history, setHistory] = useState([]);
  const videoRef = useRef(null);

  // In 'live' mode, read the real buffer from the video element instead of
  // trusting a slider - the player's actual buffered range is more honest
  // than a number a person set by hand. In 'manual' mode, use the slider
  // value directly so you can test specific buffer scenarios (e.g. forcing
  // a near-empty buffer) without needing real playback conditions to match.
  const getBufferHealth = useCallback(() => {
    if (bufferMode === 'manual') return buffer;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return buffer;
    const currentTime = video.currentTime;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= currentTime && currentTime < video.buffered.end(i)) {
        return Math.max(0, video.buffered.end(i) - currentTime);
      }
    }
    return 0;
  }, [buffer, bufferMode]);

  const askEngine = useCallback(async () => {
    const liveBuffer = getBufferHealth();
    try {
      const res = await axios.post(SERVER_URL, { bandwidth, buffer: liveBuffer, delay });
      setDecision(res.data.quality);
      setSource(res.data.source);
      setHistory(prev => [...prev.slice(-19), {
        time: new Date().toLocaleTimeString(),
        bandwidth, buffer: liveBuffer, delay,
        quality: res.data.quality,
      }]);
    } catch (err) {
      console.error('Could not reach server:', err.message);
      setSource('unreachable');
    }
  }, [bandwidth, delay, getBufferHealth]);

  useEffect(() => {
    askEngine();
    const interval = setInterval(askEngine, 3000);
    return () => clearInterval(interval);
  }, [askEngine]);

  // Rolling QoE score over the last 10 decisions (~30s), combining three
  // things a viewer actually feels: how high the quality was, how often
  // it jumped around (jarring), and how close buffer got to starving.
  const qoeScore = useMemo(() => {
    if (history.length === 0) return null;
    const recent = history.slice(-10);

    const avgQuality = recent.reduce((sum, h) => sum + h.quality, 0) / recent.length;
    const qualityScore = Math.min(avgQuality / 1080, 1) * 100;

    let switches = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].quality !== recent[i - 1].quality) switches++;
    }
    const switchPenalty = switches * 6;

    const rebufferPenalty = recent.reduce((sum, h) => {
      if (h.buffer < 2) return sum + 15;
      if (h.buffer < 5) return sum + 5;
      return sum;
    }, 0) / recent.length;

    return Math.max(0, Math.min(100, Math.round(qualityScore - switchPenalty - rebufferPenalty)));
  }, [history]);

  const qoeClass = qoeScore === null ? '' : qoeScore >= 70 ? 'good' : qoeScore >= 40 ? 'warning' : 'bad';

  return (
    <div className="App">
      <h1>FuzzyABR</h1>
      <p className="subtitle">A fuzzy-logic bitrate controller, deciding video quality every 3 seconds.</p>

      <VideoPlayer videoRef={videoRef} selectedQuality={decision} />

      <div className="decision-panel">
        <div className="stat">
          <span className="label">Fuzzy decision</span>
          <span className="value">{decision ? `${Math.round(decision)}p` : '...'}</span>
        </div>
        <div className="stat">
          <span className="label">Source</span>
          <span className={`value ${source === 'fallback' ? 'warning' : ''}`}>{source || '...'}</span>
        </div>
        <div className="stat">
          <span className="label">QoE score</span>
          <span className={`value ${qoeClass}`}>{qoeScore === null ? '...' : `${qoeScore}/100`}</span>
        </div>
      </div>

      <div className="controls">
        <h3>Simulate network conditions</h3>
        <label>
          Bandwidth: {bandwidth.toFixed(1)} Mbps
          <input type="range" min="0" max="16" step="0.5" value={bandwidth}
            onChange={e => setBandwidth(parseFloat(e.target.value))} />
        </label>
        <label>
          Delay: {delay} ms
          <input type="range" min="0" max="400" step="10" value={delay}
            onChange={e => setDelay(parseFloat(e.target.value))} />
        </label>

        <div className="buffer-mode-toggle">
          <span className="label">Buffer source</span>
          <button
            type="button"
            className={bufferMode === 'live' ? 'active' : ''}
            onClick={() => setBufferMode('live')}
          >
            Live (from player)
          </button>
          <button
            type="button"
            className={bufferMode === 'manual' ? 'active' : ''}
            onClick={() => setBufferMode('manual')}
          >
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
      </div>

      <NetworkChart history={history} />

      <div className="history">
        <h3>Recent decisions</h3>
        <table>
          <thead>
            <tr><th>Time</th><th>Bandwidth</th><th>Buffer</th><th>Delay</th><th>Quality</th></tr>
          </thead>
          <tbody>
            {history.slice().reverse().map((h, i) => (
              <tr key={i}>
                <td>{h.time}</td>
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