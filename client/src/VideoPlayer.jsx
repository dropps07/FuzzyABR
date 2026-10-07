import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

// Public multi-bitrate HLS test stream (the one hls.js's own demos use).
// Swap this for your own encoded video later if you want.
const STREAM_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

export default function VideoPlayer({ videoRef, selectedQuality }) {
  const hlsRef = useRef(null);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(null);

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
        video.play().catch(() => {}); // autoplay can be blocked, that's fine
      });

      // This is the visible proof the fuzzy decision is actually doing
      // something - every real quality switch shows up here, not just
      // a number changing somewhere off-screen.
      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentLevel(data.level);
      });

      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari has native HLS support, no hls.js needed.
      video.src = STREAM_URL;
    }
  }, [videoRef]);

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

  return (
    <div className="video-wrapper">
      <video ref={videoRef} controls muted style={{ width: '100%', maxWidth: '720px' }} />
      <p className="now-playing">
        {levels.length > 0 && currentLevel !== null
          ? `Now playing: ${levels[currentLevel]?.height}p`
          : 'Loading stream...'}
      </p>
    </div>
  );
}