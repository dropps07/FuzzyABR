import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import VideoPlayer from './VideoPlayer';
import './App.css';

const SERVER_URL = 'http://127.0.0.1:8000/api/network-status';

function App() {
  const [mode, setMode] = useState('manual'); // 'manual' | 'real'
  const [bandwidth, setBandwidth] = useState(8);
  const [delay, setDelay] = useState(60);
  const [decision, setDecision] = useState(null);
  const [source, setSource] = useState(null);
  const [history, setHistory] = useState([]);
  const videoRef = useRef(null);

  const getBufferHealth = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return 0;
    const currentTime = video.currentTime;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= currentTime && currentTime < video.buffered.end(i)) {
        return Math.max(0, video.buffered.end(i) - currentTime);
      }
    }
    return 0;
  }, []);

  const askEngine = useCallback(async () => {
    let bw, dly;
    if (mode === 'real') {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      bw = conn ? conn.downlink : 1.0;
      dly = conn ? conn.rtt : 50;
    } else {
      bw = bandwidth;
      dly = delay;
    }
    const liveBuffer = getBufferHealth();

    try {
      const res = await axios.post(SERVER_URL, { bandwidth: bw, buffer: liveBuffer, delay: dly });
      setDecision(res.data.quality);
      setSource(res.data.source);
      setHistory(prev => [...prev.slice(-29), {
        time: new Date().toLocaleTimeString(),
        bandwidth: bw, buffer: liveBuffer, delay: dly,
        quality: res.data.quality,
      }]);
    } catch (err) {
      console.error('Could not reach server:', err.message);
      setSource('unreachable');
    }
  }, [mode, bandwidth, delay, getBufferHealth]);

  useEffect(() => {
    askEngine();
    const interval = setInterval(askEngine, 3000);
    return () => clearInterval(interval);
  }, [askEngine]);

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
      </div>

      <div className="mode-toggle">
        <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>Manual</button>
        <button className={mode === 'real' ? 'active' : ''} onClick={() => setMode('real')}>Real Network</button>
      </div>

      {mode === 'manual' && (
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
          <p className="hint">Buffer is read live from the video player, not set manually.</p>
        </div>
      )}

      {mode === 'real' && (
        <p className="hint">Using your browser's real network readings (navigator.connection). Not all browsers support this — Chrome/Edge do, Firefox/Safari don't.</p>
      )}

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
    </div>
  );
}

export default App;