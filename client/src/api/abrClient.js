// src/api/abrClient.js
const API_URL = 'http://127.0.0.1:8000/api/network-status';
const HEALTH_URL = 'http://127.0.0.1:8000/api/health';

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