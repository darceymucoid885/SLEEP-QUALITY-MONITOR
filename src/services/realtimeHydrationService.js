/**
 * @file realtimeHydrationService.js
 * @description Real-Time Daytime Dehydration Alert Logic.
 *
 * Evaluates a short rolling window (~15 minutes) of sensor readings to detect
 * continuous CBT rise patterns during waking hours, triggering alerts before
 * dehydration becomes severe.
 *
 * Alert Types:
 *   - HIGH_RISK : CBT rose > 0.5°C over ≥ 15 min + HR > 80 + skin not cooling
 *   - MILD_RISK : CBT continuously rising > 0.02°C over ≥ 10 min + HR rising
 *
 * Returns null if data is insufficient, it is nighttime, or movement is too
 * high to distinguish dehydration from exercise.
 */

const evaluateDaytimeHydration = (recentReadings) => {
  if (!recentReadings || recentReadings.length < 2) {
    return null; // Not enough data for trend analysis
  }

  // Sort readings ascending by timestamp
  const sorted = [...recentReadings].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  const first = sorted[0];
  const last  = sorted[sorted.length - 1];

  const durationMs      = new Date(last.timestamp) - new Date(first.timestamp);
  const durationMinutes = durationMs / 60000;

  // ── Daytime Window Check (6 AM to 8 PM) ──────────────────────────────────
  const hour = new Date(last.timestamp).getHours();
  if (hour < 6 || hour >= 20) {
    return null; // Outside daytime monitoring window
  }

  // ── False Positive: Fever (CBT > 38°C indicates pathological not dehydration) ──
  if (last.cbt > 38.0) {
    return {
      type: 'MEDICAL_FLAG',
      message: 'CBT extremely high >38°C. Medical flag (fever), not simple dehydration.',
    };
  }

  // ── False Positive: Exercise / High Movement ──────────────────────────────
  const avgMovement = sorted.reduce((sum, r) => sum + r.movement, 0) / sorted.length;
  if (avgMovement > 0.8) {
    return null; // Ignore — likely physical activity, not dehydration
  }

  const cbtSlope      = last.cbt - first.cbt;
  const hrSlope       = last.heart_rate - first.heart_rate;
  const skinTempSlope = last.skin_temp - first.skin_temp;

  // Continuous rise check (validated by positive overall slope over window)
  const isCbtContinuouslyRising = cbtSlope > 0;

  // Evidence score to catch edge cases not met by primary conditions
  let score = 0;
  if (cbtSlope > 0)        score += 3;
  if (hrSlope > 0)         score += 1;
  if (avgMovement < 0.3)   score += 1;

  let alertType = null;
  let message   = '';

  // ── HIGH RISK: CBT risen > 0.5°C over 15+ min, HR elevated, skin not cooling ──
  if (
    durationMinutes >= 15 &&
    cbtSlope > 0.5 &&
    last.heart_rate > 80 &&
    skinTempSlope <= 0
  ) {
    alertType = 'HIGH_RISK';
    message = '🚨 Dehydration Warning\n\nSustained body temperature increase detected.\nCooling mechanism is failing.\n\nDrink water immediately and rest.';
  }
  // ── MILD RISK: CBT continuously rising for 10+ min with HR also rising ──
  else if (
    durationMinutes >= 10 &&
    isCbtContinuouslyRising &&
    cbtSlope > 0.02 &&
    hrSlope > 0
  ) {
    alertType = 'MILD_RISK';
    message = '⚠️ Hydration Alert\n\nYour body temperature is rising continuously.\nYou may be getting dehydrated.\n\nDrink water.';
  }

  // ── Score-based fallback (catches rising-but-not-extreme cases) ──
  if (!alertType && score >= 4 && cbtSlope > 0.02) {
    alertType = 'MILD_RISK';
    message = '⚠️ Hydration Alert\n\nYour body temperature is rising continuously.\nYou may be getting dehydrated.\n\nDrink water.';
  }

  if (alertType) {
    return { type: alertType, message, score };
  }

  return null;
};

module.exports = { evaluateDaytimeHydration };
