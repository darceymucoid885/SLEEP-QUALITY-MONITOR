/**
 * @file sleepStageService.js
 * @description Advanced Rule-Based Sleep Stage Classification Engine.
 *
 * Implements the rigorous physiological normalized algorithm:
 *   1. Compute robust median baselines.
 *   2. Compute 5-min rolling trends (slopes) and variances.
 *   3. Normalize values by scaling against age-specific thresholds.
 *   4. Apply strict deterministic rules (AWAKE > REM > N3 > N2 > N1).
 *   5. Apply Time-Based Corrections (N3 early bias, REM late bias).
 *   6. Apply a 2-Epoch Stability Filter (Anti-Noise / Flickering).
 */

const SensorData = require('../models/SensorData');

const EPOCH_DURATION_SEC = 30;
const TREND_WINDOW_MS    = 5 * 60 * 1000; // 5 min
const SPIKE_WINDOW_MS    = 2 * 60 * 1000; // 2 min

// ─── Utility: Compute Linear Slope ───────────────────────────────────────────
const computeSlope = (points) => {
  const n = points.length;
  if (n < 2) return 0;

  const tNorm = points.map((p) => p.t / 1000);
  const sumT   = tNorm.reduce((a, b) => a + b, 0);
  const sumV   = points.reduce((a, p) => a + p.v, 0);
  const sumTT  = tNorm.reduce((a, t) => a + t * t, 0);
  const sumTV  = points.reduce((a, p, i) => a + tNorm[i] * p.v, 0);

  const denom = n * sumTT - sumT * sumT;
  if (denom === 0) return 0;

  return (n * sumTV - sumT * sumV) / denom;
};

// ─── Utility: Compute Variance ────────────────────────────────────────────────
const computeVariance = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
};

// ─── Feature Engineering ─────────────────────────────────────────────────────
const computeFeatures = (epochReadings, baseline, thresholds, trendReadings, spikeReadings) => {
  const avg = (field) =>
    epochReadings.reduce((sum, r) => sum + r[field], 0) / epochReadings.length;

  const avgCBT  = avg('cbt');
  const avgHR   = avg('heart_rate');
  const avgRR   = avg('respiration_rate');
  const avgSkin = avg('skin_temp');
  const avgMove = avg('movement');

  // MODULE 4: Deviation (current - base)
  const cbt_dev  = avgCBT - baseline.cbt_base;
  const hr_dev   = avgHR  - baseline.hr_base;
  const rr_dev   = avgRR  - baseline.rr_base;
  const skin_dev = avgSkin - baseline.skin_base;

  // MODULE 5: Normalization
  const { CBT_drop_th, HR_drop_th, RR_range, Skin_rise_th, Move_th } = thresholds;

  // Invert HR norm for low-HR (athletic) users: a sub-45 BPM baseline means
  // a further drop is physiologically normal, not alarming.
  const isLowHRBase = baseline.hr_base < 45;

  const cbt_norm  = cbt_dev / CBT_drop_th;
  const hr_norm   = isLowHRBase ? -(hr_dev / HR_drop_th) : (hr_dev / HR_drop_th);
  const rr_norm   = Math.abs(rr_dev) / RR_range;
  const skin_norm = skin_dev / Skin_rise_th;

  // Adaptive movement thresholding: if baseline is high, scale threshold up,
  // with a minimum of 0.35 to preserve the AWAKE detection bounds.
  const effectiveMoveTh = Math.max(Move_th, baseline.movement_base * 0.8, 0.35);
  const move_norm = avgMove / effectiveMoveTh;

  // Trend Slopes (5-min rolling window)
  const cbtTrendPoints = trendReadings.map((r) => ({ t: new Date(r.timestamp).getTime(), v: r.cbt }));
  const hrTrendPoints  = trendReadings.map((r) => ({ t: new Date(r.timestamp).getTime(), v: r.heart_rate }));

  const cbt_slope = computeSlope(cbtTrendPoints);
  const hr_slope  = computeSlope(hrTrendPoints);

  // RR Variance (5-min rolling window)
  const rr_var = computeVariance(trendReadings.map((r) => r.respiration_rate));

  // HR Variance (proxy for autonomic arousal — high in REM)
  const hr_var = computeVariance(trendReadings.map((r) => r.heart_rate));

  // Move spike (max movement in last 2 mins — wake indicator)
  const move_spike = spikeReadings.length
    ? Math.max(...spikeReadings.map((r) => r.movement))
    : 0;

  return {
    // ── Normalized features (used by classifier) ──────────────────────────
    cbt_norm, hr_norm, rr_norm, skin_norm, move_norm,
    // ── Trend & variance features ─────────────────────────────────────────
    cbt_slope, hr_slope, rr_var, hr_var, move_spike,
    // ── Raw epoch averages (used by hydrationService) ─────────────────────
    avgCBT, avgHR, avgMove,
  };
};

// ─── Classification Logic ─────────────────────────────────────────────────────
const classifyEpoch = (features, timeBlockH) => {
  const { cbt_norm, hr_norm, rr_norm, skin_norm, move_norm, cbt_slope, rr_var, hr_var } = features;

  // 1. AWAKE
  // Move_norm > 1 OR HR_norm > 0 OR RR_var HIGH OR CBT_slope > 0
  if (move_norm > 1 || hr_norm > 0 || rr_var > 4.0 || cbt_slope > 0.0001) {
    return 'AWAKE';
  }

  // 2. REM
  // Move_norm < 1 AND HR_var HIGH AND RR_var HIGH AND CBT_slope ≈ 0 or slight rise AND occurs after 60-90 min
  if (timeBlockH > 1.0) {
    if (move_norm < 1.0 && hr_var > 5.0 && rr_var > 2.0 && cbt_slope >= -0.00005) {
      return 'REM';
    }
  }

  // 3. N3 (DEEP SLEEP)
  // Move_norm ≈ 0 AND HR_norm < -0.8 AND RR_norm < 1 AND CBT_norm < -0.8 AND Skin_norm > 0.8
  const isEarlyNight = timeBlockH < 2.0;
  if (move_norm < 0.3 && hr_norm < -0.8 && rr_norm < 1.0 && cbt_norm < -0.8 && skin_norm > 0.8) {
    return 'N3';
  }
  // MODULE 7: Time-based correction (N3 more likely early)
  if (isEarlyNight && move_norm < 0.5 && hr_norm < -0.5 && cbt_norm < -0.5 && rr_norm < 1.0) {
    return 'N3';
  }

  // 4. N2 (STABLE SLEEP)
  // Move_norm < 1 AND HR_norm < -0.5 AND RR_norm < 1 AND CBT_norm < -0.5 AND Skin_norm > 0.5
  if (move_norm < 1.0 && hr_norm < -0.5 && rr_norm < 1.0 && cbt_norm < -0.5 && skin_norm > 0.5) {
    return 'N2';
  }
  // MODULE 7: Middle of the night -> N2 dominant (fallback if conditions partially met)
  const isMiddleNight = timeBlockH >= 2.0 && timeBlockH <= 5.0;
  if (isMiddleNight && move_norm < 1.0 && hr_norm < -0.2 && cbt_norm < -0.2) {
    return 'N2';
  }

  // MODULE 7: Last hours -> REM dominant
  const isLateNight = timeBlockH > 5.0;
  if (isLateNight && move_norm < 1.0 && hr_var > 3.0 && rr_var > 1.5) {
    return 'REM';
  }

  // 5. N1 (TRANSITION)
  // Default if not matching others: Move decreasing, HR slightly < 0, CBT_slope < 0
  return 'N1';
};

// ─── Main Orchestrator ────────────────────────────────────────────────────────
const classifySleepStages = async (userId, sleepStart, sleepEnd, baseline, thresholds) => {
  const readings = await SensorData.find({
    user_id: userId,
    timestamp: { $gte: sleepStart, $lte: sleepEnd },
  }).sort({ timestamp: 1 });

  if (readings.length === 0) {
    throw new Error('No sensor data found for the specified sleep window.');
  }

  const rawEpochs = [];
  const startMs = new Date(readings[0].timestamp).getTime();
  let epochIndex = 0;

  // Process raw classifications
  for (let offsetMs = 0; ; offsetMs += EPOCH_DURATION_SEC * 1000) {
    const epochStart = startMs + offsetMs;
    const epochEnd   = epochStart + EPOCH_DURATION_SEC * 1000;

    const epochReadings = readings.filter(r => {
      const t = new Date(r.timestamp).getTime();
      return t >= epochStart && t < epochEnd;
    });

    if (epochReadings.length === 0) break;

    const trendReadings = readings.filter(r => {
      const t = new Date(r.timestamp).getTime();
      return t >= (epochStart - TREND_WINDOW_MS) && t < epochEnd;
    });

    const spikeReadings = readings.filter(r => {
      const t = new Date(r.timestamp).getTime();
      return t >= (epochStart - SPIKE_WINDOW_MS) && t < epochEnd;
    });

    const features = computeFeatures(epochReadings, baseline, thresholds, trendReadings, spikeReadings);
    
    // Calculate hours since sleep start for time-based contextual bias
    const timeBlockH = offsetMs / (1000 * 60 * 60);
    const stage = classifyEpoch(features, timeBlockH);

    rawEpochs.push({
      epoch_index: epochIndex,
      start_time:  new Date(epochStart),
      end_time:    new Date(epochEnd),
      stage,
      ...features
    });

    epochIndex++;
  }

  // MODULE 8: STABILITY FILTER
  // Stage change only if same result for 2 consecutive epochs
  // Exception: AWAKE interrupts immediately
  const stableEpochs = [...rawEpochs];
  
  for (let i = 1; i < stableEpochs.length - 1; i++) {
    const prev = stableEpochs[i-1].stage;
    const curr = stableEpochs[i].stage;
    const next = stableEpochs[i+1].stage;

    if (curr === 'AWAKE') continue;

    if (curr !== prev && curr !== next) {
      stableEpochs[i].stage = prev; 
    }
  }

  return stableEpochs;
};

module.exports = { classifySleepStages };
