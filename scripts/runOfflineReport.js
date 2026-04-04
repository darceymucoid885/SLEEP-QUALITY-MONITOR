/**
 * @file runOfflineReport.js
 * @description Offline (MongoDB-bypassed) sleep analysis pipeline runner.
 *
 * Reads a CSV file directly from disk and runs the full physiological engine
 * in-memory, printing a detailed diagnostic report to the console.
 *
 * Useful for rapid algorithm validation without a running MongoDB instance.
 *
 * Usage:
 *   node scripts/runOfflineReport.js
 *
 * The CSV file path is configured below (DATA_FILE_PATH).
 * Update it to point to any sample file in data/samples/.
 */

require('dotenv').config();
const fs       = require('fs');
const readline = require('readline');

const User      = require('../src/models/User');
const SensorData = require('../src/models/SensorData');
const { getThresholds }    = require('../src/services/ageThresholdsService');
const { calculateBaseline } = require('../src/services/baselineService');
const { classifySleepStages } = require('../src/services/sleepStageService');
const { computeSleepQuality, detectWakeTime, detectSleepStart } = require('../src/services/scoringService');
const { assessHydration }   = require('../src/services/hydrationService');

// ─── Configuration ─────────────────────────────────────────────────────────────
const DATA_FILE_PATH = 'd:\\PERSONAL_SLEEP_QUALITY\\data\\samples\\subject_60yo_48h.csv';
const MOCK_USER      = { _id: 'mock_60yo_id', name: 'Age 60 Subject', age: 60, gender: 'male' };
// ───────────────────────────────────────────────────────────────────────────────

async function run() {
  try {
    console.log('✅ Running in purely in-memory mode (MongoDB bypassed)');

    const user = MOCK_USER;

    console.log(`Reading CSV from: ${DATA_FILE_PATH}`);
    console.log('This may take a moment for large files (~170k rows)...');

    const fileStream = fs.createReadStream(DATA_FILE_PATH);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let isFirst = true;
    const records = [];
    let count = 0;

    for await (const line of rl) {
      if (isFirst) { isFirst = false; continue; }

      const cols = line.split(',');
      if (cols.length >= 6) {
        records.push({
          user_id:          user._id,
          timestamp:        new Date(cols[0].trim()),
          cbt:              parseFloat(cols[1]),
          heart_rate:       parseFloat(cols[2]),
          respiration_rate: parseFloat(cols[3]),
          skin_temp:        parseFloat(cols[4]),
          movement:         parseFloat(cols[5]),
        });
        count++;
        if (count % 20000 === 0) process.stdout.write(`\rLoaded ${count} records...`);
      }
    }
    console.log(`\n✅ Finished parsing ${count} records into memory.`);

    // ── MOCK Mongoose Query Methods ────────────────────────────────────────────
    SensorData.find = (query) => {
      const gte = query.timestamp.$gte.getTime();
      const lte = query.timestamp.$lte.getTime();
      return {
        sort: () => records.filter(
          (r) => r.timestamp.getTime() >= gte && r.timestamp.getTime() <= lte
        ),
      };
    };

    User.findOne = () => Promise.resolve(user);
    User.create  = () => Promise.resolve(user);
    // ──────────────────────────────────────────────────────────────────────────

    console.log('🚀 Running physiological engine...');

    // Use the night of 2026-03-30 (10 PM → 8 AM)
    const sessionDate = new Date('2026-03-30T00:00:00.000Z');

    const winStart = new Date(sessionDate);
    winStart.setHours(22, 0, 0, 0); // 10 PM

    const winEnd = new Date(sessionDate);
    winEnd.setDate(winEnd.getDate() + 1);
    winEnd.setHours(8, 0, 0, 0);   // 8 AM next day

    const thresholds = getThresholds(user.age);
    console.log(`\n1️⃣  Age configuration loaded for age ${user.age}: ${thresholds.ageGroup}`);

    const baseline = await calculateBaseline(user._id, sessionDate);
    console.log('\n2️⃣  Baseline calculated from pre-sleep window:', baseline);

    console.log('\n3️⃣  Classifying sleep architecture (may take a few seconds)...');
    const epochs = await classifySleepStages(user._id, winStart, winEnd, baseline, thresholds);
    console.log(`   Generated ${epochs.length} 30-sec physiological epochs.`);

    const scoreData  = computeSleepQuality(epochs, thresholds);
    const hydration  = assessHydration(epochs, thresholds.ageGroup.toLowerCase());

    const detectedStart = detectSleepStart(epochs) || new Date(epochs[0].start_time);
    const detectedEnd   = detectWakeTime(epochs)   || new Date(epochs[epochs.length - 1].start_time);

    console.log('\n======================================================');
    console.log(' 🔬 SLEEP DIAGNOSTIC REPORT (AGE 60 PROFILE)');
    console.log('======================================================');
    console.log(`⏱️  Sleep Window: ${detectedStart.toLocaleTimeString()} - ${detectedEnd.toLocaleTimeString()}`);
    console.log(`🏆 Quality Score: ${scoreData.sleep_quality_score}/100 (${scoreData.sleep_quality})`);
    console.log(`💧 Hydration Risk: ${hydration.hydration_status} (σ=${hydration.medianStrainDev})`);
    console.log(`💡 Explanation:\n   ${scoreData.explanation}`);
    console.log('📝 Suggestions:');
    scoreData.suggestions.forEach((s) => console.log(`   - ${s}`));

    const stageCounts = epochs.reduce((acc, e) => {
      acc[e.stage] = (acc[e.stage] || 0) + 1;
      return acc;
    }, { AWAKE: 0, N1: 0, N2: 0, N3: 0, REM: 0 });

    console.log('\n📊 STAGE DISTRIBUTION:');
    for (const [stage, c] of Object.entries(stageCounts)) {
      console.log(`   ${stage}: ${Math.round((c / epochs.length) * 100)}% (${c} epochs)`);
    }
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Fatal Error:', err);
    process.exit(1);
  }
}

run();
