/**
 * @file simulateDehydrationBatch.js
 * @description Development simulator for real-time dehydration alert pipeline.
 *
 * Sends a crafted batch of sensor readings to POST /sensor-data/batch that
 * should trigger a HIGH_RISK dehydration alert via the WebSocket channel.
 *
 * The simulated 15-minute window shows:
 *   - CBT rising continuously from 37.0°C → 37.6°C (+0.6°C)
 *   - HR rising from 70 → 100 BPM (indicative of thermoregulatory strain)
 *   - Skin temperature fixed (cooling mechanism not activating)
 *   - Low movement (rules out exercise false positive)
 *
 * ⚠️  IMPORTANT: This script sends to /sensor-data/batch which requires:
 *   1. A running server (`npm run dev`)
 *   2. A valid JWT in the Authorization header (currently omitted — for local testing only)
 *   3. A valid MongoDB ObjectId as user_id (currently using a placeholder)
 *
 * For live testing, replace MOCK_USER_ID with a real user ID from the DB
 * and add the Authorization header with a valid Bearer token.
 */

const http = require('http');

// ─── Configuration ─────────────────────────────────────────────────────────────
// Replace with a real MongoDB ObjectId and Bearer token for live testing
const MOCK_USER_ID = 'mock_user_123';  // ← NOT a valid MongoId; for shape demo only
const AUTH_TOKEN   = '';              // ← Set a real JWT token for live testing
// ───────────────────────────────────────────────────────────────────────────────

console.log('🚀 Starting Dehydration Batch Simulator...');

// Simulate a 15-minute window starting at 10:00 AM
const baseTime = new Date();
baseTime.setHours(10, 0, 0, 0);

const readings = [];
let cbt     = 37.0;
let hr      = 70;
const skinTemp = 33.0; // Skin temp stays flat → cooling mechanism not activating

// 16 readings, 1-minute intervals → 15-minute window
for (let i = 0; i <= 15; i++) {
  const ts = new Date(baseTime.getTime() + i * 60000);
  readings.push({
    timestamp:        ts.toISOString(),
    cbt:              parseFloat(cbt.toFixed(2)),
    heart_rate:       hr,
    respiration_rate: 16,
    skin_temp:        skinTemp,
    movement:         0.1, // low movement → rules out exercise
  });

  cbt += 0.04; // +0.6°C total over 15 minutes
  hr  += 2;    // +30 BPM total → significant tachycardia
}

console.log(`Generated ${readings.length} readings spanning 15 minutes.`);
console.log(`CBT:  ${readings[0].cbt}°C → ${readings[readings.length - 1].cbt}°C`);
console.log(`HR:   ${readings[0].heart_rate} bpm → ${readings[readings.length - 1].heart_rate} bpm`);

const payload = JSON.stringify({ user_id: MOCK_USER_ID, readings });

const options = {
  hostname: 'localhost',
  port:     5000,
  path:     '/sensor-data/batch',
  method:   'POST',
  headers:  {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...(AUTH_TOKEN && { 'Authorization': `Bearer ${AUTH_TOKEN}` }),
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log(`\nResponse Status: ${res.statusCode}`);
    console.log(`Response Body:   ${body}`);
    console.log('✅ Simulated payload sent.');
  });
});

req.on('error', (e) => {
  console.error(`❌ Request failed: ${e.message}`);
});

req.write(payload);
req.end();
