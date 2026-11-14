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
