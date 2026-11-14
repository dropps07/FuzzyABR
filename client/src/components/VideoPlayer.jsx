import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

// Live Red Bull TV channel (motorsport, racing, bikes, cars, Air Race).
// Public HLS master playlist, 6 adaptive levels (180p–1080p), CORS open —
// verified live 2026-11-14. The ladder shows this stream's real levels.
const STREAM_URL = 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8';

export default function VideoPlayer({ videoRef, selectedQuality, onLevelsChange, onLevelChange }) {
  const hlsRef = useRef(null);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [streamError, setStreamError] = useState(false);

  // Set up hls.js once, on mount.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(STREAM_URL);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setLevels(data.levels);
        if (onLevelsChange) onLevelsChange(data.levels);
        video.play().catch(() => {}); // autoplay can be blocked, that's fine
      });

      // This is the visible proof the fuzzy decision is actually doing
      // something - every real quality switch shows up here, not just
      // a number changing somewhere off-screen.
      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentLevel(data.level);
        if (onLevelChange) onLevelChange(data.level);
      });

      // A fatal error means hls.js has stopped — a live channel can drop
      // out. Say so plainly instead of leaving "Loading stream..." forever.
      // Non-fatal errors are left alone so hls.js can recover on its own.
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setStreamError(true);
        }
      });

      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari has native HLS support, no hls.js needed.
      video.src = STREAM_URL;
    }
  }, [videoRef, onLevelsChange, onLevelChange]);

  // Whenever the fuzzy engine's decision changes, map it to the
  // closest available HLS quality level and switch to it.
  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || !selectedQuality || levels.length === 0) return;

    let closestIndex = 0;
    let closestDiff = Infinity;
    levels.forEach((lvl, i) => {
      const diff = Math.abs(lvl.height - selectedQuality);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    });

    if (hls.nextLevel !== closestIndex) {
      hls.nextLevel = closestIndex;
    }
  }, [selectedQuality, levels]);

  const playingLevel =
    levels.length > 0 && currentLevel !== null ? levels[currentLevel] : null;

  return (
    <div className="video-wrapper">
      <video ref={videoRef} controls muted style={{ width: '100%', maxWidth: '720px' }} />
      <div className={`now-playing${streamError ? ' now-playing-error' : ''}`} role="status">
        <span className="now-playing-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M8.5 5.8v12.4L19 12 8.5 5.8z"
              fill="#fff"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="now-playing-text">
          {streamError
            ? 'Stream unavailable right now — it\u2019s a live channel, try reloading the page.'
            : playingLevel
              ? `Now playing: ${playingLevel.height}p`
              : 'Loading stream...'}
        </span>
      </div>
    </div>
  );
}