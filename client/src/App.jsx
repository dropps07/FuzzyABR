
import { useState, useRef } from 'react';
import VideoPlayer from './components/VideoPlayer';
import NetworkChart from './components/NetworkChart';
import { useAbrEngine } from './hooks/useAbrEngine';
import { getBufferAhead } from './utils/buffer';
import { computeQoe, qoeClass } from './utils/qoe';
import './App.css';

function App() {
  const [bandwidth, setBandwidth] = useState(8);
  const [delay, setDelay] = useState(60);
  const [buffer, setBuffer] = useState(15);
  const [bufferMode, setBufferMode] = useState('live'); // 'live' | 'manual'
  const videoRef = useRef(null);

  const { decision, source, history } = useAbrEngine({
    bandwidth,
    delay,
    getBuffer: () =>
      bufferMode === 'manual' ? buffer : getBufferAhead(videoRef.current),
  });

  const qoe = computeQoe(history);

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
          <span className={`value ${qoeClass(qoe)}`}>{qoe === null ? '...' : `${qoe}/100`}</span>
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
      </div>

      <NetworkChart history={history} />

      <div className="history">
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