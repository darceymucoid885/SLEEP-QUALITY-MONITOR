/**
 * @file generateIdealNightCSV.js
 * @description Synthetic ideal sleep CSV generator.
 *
 * Generates a 1-second resolution physiological dataset representing
 * a textbook-ideal sleep night (Score ~7/8). Output is written to:
 *   data/samples/ideal_night_score_7.csv
 *
 * The generated night contains:
 *   - 30 min awake (9 PM → 9:30 PM)
 *   - 20 min sleep onset (CBT continuous drop: 37.2 → 36.4°C)
 *   - 150 min N3 deep sleep
 *   - 70 min N2 light sleep
 *   - 180 min REM
 *   - 30 min natural waking ascent (CBT rise: 36.7 → 37.2°C)
 *   - 30 min morning routine
 *
 * Usage:
 *   node scripts/generateIdealNightCSV.js
 */

const fs   = require('fs');
const path = require('path');

const generate = () => {
  let output = 'timestamp,cbt(degC),heart_rate(bpm),respiration_rate(brpm),skin_temp(degC),movement(norm),HRV(ms),Stage\n';

  const baseTime = new Date();
  baseTime.setHours(21, 0, 0, 0); // Start at 9 PM

  let m = 0; // minutes elapsed

  /**
   * Writes a block of 1-second readings for `durationMins` minutes.
   * @param {number}          durationMins
   * @param {number|function} cbtFn    - CBT value or fn(minuteIndex)
   * @param {number}          hr
   * @param {number}          rr
   * @param {number}          skin
   * @param {number|function} moveFn   - Move value or fn(minuteIndex)
   */
  const writeBlock = (durationMins, cbtFn, hr, rr, skin, moveFn) => {
    for (let i = 0; i < durationMins; i++) {
      const currentCbt  = typeof cbtFn  === 'function' ? cbtFn(i)  : cbtFn;
      const currentMove = typeof moveFn === 'function' ? moveFn(i) : moveFn;

      for (let s = 0; s < 60; s++) {
        const t        = new Date(baseTime.getTime() + (m * 60 + s) * 1000);
        const cbtNoise  = currentCbt  + (Math.random() * 0.02 - 0.01);
        const moveNoise = currentMove + (Math.random() * 0.02 - 0.01);
        output += `${t.toISOString()},${cbtNoise.toFixed(3)},${hr},${rr},${skin},${moveNoise.toFixed(2)},50,\n`;
      }
      m++;
    }
  };

  console.log('Generating 1-second interval biological profiles...');

  // 1. Initial Awake Phase (9:00 PM → 9:30 PM) — 30 mins
  writeBlock(30, 37.2, 75, 15, 32.0, 0.5);

  // 2. Sleep Onset Phase (9:30 PM → 9:50 PM) — 20 mins; CBT drops 37.2 → 36.4
  console.log('Injecting Sleep Onset Descent...');
  writeBlock(20, (i) => 37.2 - (i * (0.8 / 20)), 65, 14, 33.0, 0.05);

  // 3. Main N3 Deep Sleep Phase (9:50 PM → 12:20 AM) — 150 mins
  console.log('Injecting Deep Sleep (N3) Block...');
  writeBlock(150, 36.4, 55, 12, 34.0, 0.03);

  // 4. Stable N2 Phase (12:20 AM → 1:30 AM) — 70 mins
  console.log('Injecting Stable Sleep (N2) Block...');
  writeBlock(70, 36.6, 58, 13, 33.5, 0.12);

  // 5. REM Sleep Phase (1:30 AM → 4:30 AM) — 180 mins
  console.log('Injecting REM Cycle Block...');
  writeBlock(180, 36.7, 60, 15, 34.5, 0.2);

  // 6. Wake-Up Transition (4:30 AM → 5:00 AM) — 30 mins; CBT rises 36.7 → 37.2
  console.log('Injecting Natural Waking Ascent...');
  writeBlock(30, (i) => 36.7 + (i * (0.5 / 30)), 70, 16, 33.0, 0.4);

  // 7. Morning Awake Routine (5:00 AM → 5:30 AM) — 30 mins
  writeBlock(30, 37.2, 80, 16, 32.5, 0.6);

  const outPath = path.join(__dirname, '..', 'data', 'samples', 'ideal_night_score_7.csv');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output);

  console.log(`✅ Success! Dataset written to ${outPath}`);
  console.log('Total synthesized rows:', m * 60);
};

generate();
