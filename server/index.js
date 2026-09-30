const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8000;
const FUZZY_ENGINE_URL = 'http://127.0.0.1:5001';

app.use(cors());
app.use(express.json());

const LOG_FILE = path.join(__dirname, 'requests.log');

function logEvent(entry) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('Failed to write log:', err.message);
  });
}

app.post('/api/network-status', async (req, res) => {
  const { bandwidth, buffer, delay } = req.body;

  try {
    const response = await axios.post(`${FUZZY_ENGINE_URL}/get-quality`, {
      bandwidth, buffer, delay
    }, { timeout: 2000 });

    const quality = response.data.quality;
    logEvent({ inputs: { bandwidth, buffer, delay }, quality, source: 'fuzzy_engine' });

    res.json({ quality, source: 'fuzzy_engine' });

  } catch (err) {
    console.warn('Fuzzy engine unreachable:', err.message);
    logEvent({ inputs: { bandwidth, buffer, delay }, quality: 360, source: `fallback (${err.message})` });

    res.json({ quality: 360, source: 'fallback', reason: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await axios.get(`${FUZZY_ENGINE_URL}/health`, { timeout: 2000 });
    res.json({ server: 'ok', fuzzy_engine: 'ok' });
  } catch (err) {
    res.json({ server: 'ok', fuzzy_engine: 'unreachable' });
  }
});

app.listen(PORT, () => {
  console.log(`FuzzyABR server running on http://127.0.0.1:${PORT}`);
});