/**
 * @file baselineService.js
 * @description Adaptive Baseline Engine.
 *
 * Calculates a physiological baseline for a sleep session using
 * the daytime window: 10:00 AM – 6:00 PM (10:00–18:00) on the
 * session date. This excludes post-dinner and pre-sleep elevation
 * that would artificially inflate the baseline.
 *
 * Methodology:
 *   - Median is used instead of mean to reduce outlier sensitivity.
 *   - A minimum of 5 data points is required for a reliable baseline.
 *   - If insufficient data exists in the pre-sleep window, an error is thrown.
 */

const SensorData = require('../models/SensorData');

// ─── Internal Utility: Calculate Median ──────────────────────────────────────
/**
 * Computes the median of a sorted numeric array.
 * This is more robust than mean for physiological data which may have spikes.
 *
 * @param {number[]} arr - Array of numeric values
 * @returns {number|null} Median value, or null if array is empty
 */
const median = (arr) => {
  if (!arr || arr.length === 0) return null;

  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

// ─── Main Baseline Calculation Function ──────────────────────────────────────
/**
 * Fetches pre-sleep sensor data (6PM–10PM) for a given user and session date,
 * and computes the median baseline for each physiological metric.
 *
 * @param {string} userId         - MongoDB ObjectId string of the user
 * @param {Date}   sessionDate    - The date of the sleep session (midnight of the night)
 * @returns {Promise<{
 *   cbt_base:      number,
 *   hr_base:       number,
 *   rr_base:       number,
 *   skin_base:     number,
 *   movement_base: number
 * }>} Resolved baseline object
 *
 * @throws {Error} If fewer than 5 data points are found in the pre-sleep window
 */
const calculateBaseline = async (userId, sessionDate) => {
  // Build the daytime baseline window: 10 AM to 6 PM on session date (Day Window per thesis)
  const preSleepStart = new Date(sessionDate);
  preSleepStart.setHours(10, 0, 0, 0);  // 10:00 AM

  const preSleepEnd = new Date(sessionDate);
  preSleepEnd.setHours(18, 0, 0, 0);    // 6:00 PM

  // Fetch all sensor readings falling in the pre-sleep window
  const readings = await SensorData.find({
    user_id: userId,
    timestamp: { $gte: preSleepStart, $lte: preSleepEnd },
  }).sort({ timestamp: 1 }); // Ascending by time

  // Minimum data quality check: at least 5 readings needed for reliable baseline
  if (readings.length < 5) {
    throw new Error(
      `Insufficient daytime data for baseline calculation. ` +
      `Found ${readings.length} readings; need at least 5 in the 10AM–6PM window.`
    );
  }

  // Extract individual metric arrays
  const cbtArr       = readings.map((r) => r.cbt);
  const hrArr        = readings.map((r) => r.heart_rate);
  const rrArr        = readings.map((r) => r.respiration_rate);
  const skinArr      = readings.map((r) => r.skin_temp);
  const movementArr  = readings.map((r) => r.movement);

  // Calculate median-based baselines
  const baseline = {
    cbt_base:       parseFloat(median(cbtArr).toFixed(3)),
    hr_base:        parseFloat(median(hrArr).toFixed(3)),
    rr_base:        parseFloat(median(rrArr).toFixed(3)),
    skin_base:      parseFloat(median(skinArr).toFixed(3)),
    movement_base:  parseFloat(median(movementArr).toFixed(4)),
  };

  console.log(`📊 Baseline calculated for user ${userId} on ${sessionDate.toDateString()}:`, baseline);
  return baseline;
};

// ─── exported as runtime calculation ─────────────────────────────────────────
module.exports = { calculateBaseline };
