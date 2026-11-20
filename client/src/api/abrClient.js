// src/api/abrClient.js
//
// The server URL comes from the build environment when hosted
// (Render static site: REACT_APP_SERVER_URL) and falls back to the local
// dev server. Create React App inlines REACT_APP_* vars at BUILD time, so
// a hosted build must be built with the var set — it cannot be changed
// at runtime afterwards.
const SERVER = (process.env.REACT_APP_SERVER_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const API_URL = `${SERVER}/api/network-status`;
const HEALTH_URL = `${SERVER}/api/health`;

// The fuzzy engine's own URL, for the wake-up ping below. Same pattern
// as SERVER: REACT_APP_ENGINE_URL at build time, otherwise the deployed
// engine — the ping only matters for the hosted demo (a local engine
// never sleeps), so the deployed URL is the default, not localhost.
// Override with REACT_APP_ENGINE_URL if the engine ever moves.
const ENGINE_URL = (process.env.REACT_APP_ENGINE_URL || 'https://fuzzyabr-engine.onrender.com').replace(/\/$/, '');
const ENGINE_HEALTH_URL = `${ENGINE_URL}/health`;

// Wake the sleeping engine: one GET at its /health on page load, result
// ignored. Render's free tier sleeps the engine after 15 idle minutes
// (~13s to wake); the server's polls alone never wake it, so a first
// visitor would sit on "Engine unreachable" until something hits the
// engine directly. This is that hit. Fire-and-forget — it never throws,
// never blocks the UI, and a failure just means the server's polls keep
// trying as before.
export function wakeEngine() {
  fetch(ENGINE_HEALTH_URL, { cache: 'no-store' }).catch(() => {});
}

export async function fetchDecision(payload, signal) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchHealth(signal) {
  const res = await fetch(HEALTH_URL, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
