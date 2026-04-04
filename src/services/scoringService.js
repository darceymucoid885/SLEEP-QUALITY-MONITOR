/**
 * @file scoringService.js
 * @description Advanced Sleep Quality Scoring & Wake-Up Detection Engine.
 *
 * Implements strict epoch-level quality aggregation:
 *   - CBT falling           → +2
 *   - HR falling            → +2
 *   - RR stable             → +1
 *   - Skin temp rising      → +1
 *   - Movement low          → +2
 *   Max: 8 points per epoch.
 *
 * Overall `SleepQualityScore` = (average epochs / max) * 100
 * Efficiency & Fragmentation calculations included for robust reporting.
 */

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_EPOCH_SCORE = 8;

const computeSleepQuality = (epochs, thresholds) => {
  let totalScore = 0;
  let sleepEpochs = 0;
  let wakeEpochs = 0;
  let fragmentationCount = 0;

  // Track the raw points across all valid sleeping epochs
  epochs.forEach((e) => {
    // Determine bounds and states
    if (e.stage === 'AWAKE') {
      wakeEpochs++;
      if (e.move_spike > thresholds.Move_th) fragmentationCount++;
      return; // Only score sleeping epochs
    }

    sleepEpochs++;
    let points = 0;

    // Based on normalization (negative norm means successfully dropped/crossed threshold downwards)
    if (e.cbt_norm < 0) points += 2;
    if (e.hr_norm < 0) points += 2;
    if (e.rr_norm < 1.0) points += 1;
    if (e.skin_norm > 0) points += 1;
    if (e.move_norm < 1.0) points += 2;

    e.epoch_score = points; // Assign directly to epoch object for downstream
    totalScore += points;
  });

  // Calculate metrics
  const totalEpochs = epochs.length;
  // Sleep efficiency: time spent asleep vs awake
  const efficiency = totalEpochs > 0 ? (sleepEpochs / totalEpochs) * 100 : 0;
  
  // Aggregate Quality Score: % of total possible perfect sleep points achieved
  const maxPossiblePoints = sleepEpochs * MAX_EPOCH_SCORE;
  const rawQualityRatio = maxPossiblePoints > 0 ? (totalScore / maxPossiblePoints) * 100 : 0;
  const sleep_quality_score = Math.round(rawQualityRatio); // 0-100 scale

  // Calculate Average Epoch Score for standard 0-8 Quality Grouping
  const avgEpochScore = sleepEpochs > 0 ? (totalScore / sleepEpochs) : 0;

  let sleep_quality;
  if (avgEpochScore >= 6) {
    sleep_quality = 'GOOD';
  } else if (avgEpochScore >= 3) {
    sleep_quality = 'MODERATE';
  } else {
    sleep_quality = 'POOR';
  }

  // Generate Explanatory Texts
  const suggestions = [];
  let explanation = '';

  if (sleep_quality === 'GOOD') {
    explanation = 'CBT dropped normally after sleep onset, HR reduced, movement stayed low, and skin temperature increased, indicating good thermoregulation and good sleep quality.';
    suggestions.push('Maintain fixed sleep timing.', 'Keep bedroom cool.');
  } else {
    explanation = 'CBT did not fall enough and HR stayed elevated, suggesting possible dehydration or disturbed sleep structure.';
    suggestions.push('Hydrate earlier in the evening.', 'Avoid excess late-night fluids.', 'Reduce screen exposure 1 hour before sleep.');
  }

  return {
    sleep_quality_score, // e.g. 82
    sleep_quality,       // 'GOOD'
    sleep_efficiency:    efficiency,
    fragmentation_count: fragmentationCount,
    explanation,
    suggestions,
  };
};

// ─── Wake-Up Detection (Time Independent) ───────────────────────────────────
/**
 * CORE LOGIC: Final Wake Detection
 * IF CBT continuously rising >= 20 min AND HR rising AND movement sustained -> FINAL WAKE
 * Micro-wakes handled implicitly because the 20-min window won't trigger if CBT drops again.
 */
const detectWakeTime = (epochs) => {
  const sleepStart = detectSleepStart(epochs);
  const sleepStartMs = sleepStart ? sleepStart.getTime() : new Date(epochs[0]?.start_time).getTime();
  if (!sleepStartMs || isNaN(sleepStartMs)) return null;

  // Only evaluate epochs after the physiological sleep onset
  const sleepEpochs = epochs.filter((e) => new Date(e.start_time).getTime() >= sleepStartMs);
  
  const BUFFER_WINDOW = 40; // 20 mins grace window at 30s/epoch
  
  for (let i = 0; i <= sleepEpochs.length - BUFFER_WINDOW; i++) {
    const slice = sleepEpochs.slice(i, i + BUFFER_WINDOW);
    
    const startCbt = slice[0].cbt_norm;
    const endCbt = slice[BUFFER_WINDOW - 1].cbt_norm;
    
    // CBT rising continuously for 20 mins
    const cbtRising = (endCbt - startCbt) > 0.1 && slice.filter(e => e.cbt_slope >= -0.0001).length >= BUFFER_WINDOW * 0.7;
    
    // HR rising consistently
    const hrRising = slice.filter(e => e.hr_slope >= -0.001 || e.hr_norm >= 0).length >= BUFFER_WINDOW * 0.7;
    
    // Sustained movement
    const avgMove = slice.reduce((sum, e) => sum + e.move_norm, 0) / BUFFER_WINDOW;
    const moveSustained = avgMove > 0.8; 
    
    if (cbtRising && hrRising && moveSustained) {
      return new Date(slice[0].start_time); // Timestamp where the final rise cascade initiated
    }
  }
  
  // Fallback: If no strict awakening sequence detected, sleep continued until the end of the recording.
  return sleepEpochs.length > 0
    ? new Date(sleepEpochs[sleepEpochs.length - 1].start_time)
    : null;
};

// ─── Sleep Onset Detection (Time Independent) ─────────────────────────────────
/**
 * SLEEP ONSET DETECTION
 * IF CBT continuously decreasing >= 20 min AND HR decreasing AND movement low -> SLEEP START
 */
const detectSleepStart = (epochs) => {
  const WINDOW = 40; // 20 mins at 30s/epoch
  if (epochs.length < WINDOW) return epochs[0] ? new Date(epochs[0].start_time) : null;

  for (let i = 0; i <= epochs.length - WINDOW; i++) {
    const slice = epochs.slice(i, i + WINDOW);
    
    const startCbt = slice[0].cbt_norm;
    const endCbt = slice[WINDOW - 1].cbt_norm;
    
    // CBT dropping continuously
    const cbtDropping = (startCbt - endCbt) > 0.1 && slice.filter(e => e.cbt_slope <= 0.0001).length >= WINDOW * 0.7;

    // HR decreasing
    const hrDropping = slice.filter(e => e.hr_slope <= 0.001 || e.hr_norm <= 0).length >= WINDOW * 0.7;

    // Movement low
    const avgMove = slice.reduce((sum, e) => sum + e.move_norm, 0) / WINDOW;
    const moveLow = avgMove < 1.0;

    if (cbtDropping && hrDropping && moveLow) {
      return new Date(slice[0].start_time);
    }
  }
  
  // Fallback: if data is too noisy for strict biological trending, find the first solid block
  for (let i = 0; i < epochs.length - 10; i++) {
    if (epochs.slice(i, i + 10).every(e => e.stage !== 'AWAKE')) {
        return new Date(epochs[i].start_time);
    }
  }
  
  return new Date(epochs[0].start_time);
};

module.exports = { computeSleepQuality, detectWakeTime, detectSleepStart };
