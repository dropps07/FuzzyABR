import { useEffect, useRef, useState } from 'react';
import { fetchDecision } from '../api/abrClient';

const POLL_MS = 3000;
const MAX_HISTORY = 20;

export function useAbrEngine({ bandwidth, delay, getBuffer }) {
  const [decision, setDecision] = useState(null);
  const [source, setSource] = useState(null);
  const [history, setHistory] = useState([]);

  // Latest inputs, readable by the interval without re-creating it
  const inputs = useRef({ bandwidth, delay, getBuffer });
  useEffect(() => {
    inputs.current = { bandwidth, delay, getBuffer };
  });

  // Lives outside the effect, so ids stay unique across StrictMode/Fast Refresh
  const seq = useRef(0);

  useEffect(() => {
    const ctrl = new AbortController();

    const tick = async () => {
      const { bandwidth, delay, getBuffer } = inputs.current;
      const buffer = getBuffer();
      if (buffer === null) return; // player not ready yet

      try {
        const res = await fetchDecision({ bandwidth, buffer, delay }, ctrl.signal);
        const entry = {
          id: seq.current++,
          t: Date.now(),
          bandwidth,
          buffer,
          delay,
          quality: res.quality,
          source: res.source,
        };
        setDecision(res.quality);
        setSource(res.source);
        setHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), entry]);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setSource('unreachable');
      }
    };

    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      clearInterval(timer);
      ctrl.abort();
    };
  }, []);

  return { decision, source, history };
}