/**
 * @file analysisController.js
 * @description Advanced Sleep Analysis Controller matching final deterministic algorithms.
 */

const User = require('../models/User');
const SleepAnalysis = require('../models/SleepAnalysis');
const { getThresholds } = require('../services/ageThresholdsService');
const { calculateBaseline } = require('../services/baselineService');
const { classifySleepStages } = require('../services/sleepStageService');
const { computeSleepQuality, detectWakeTime, detectSleepStart } = require('../services/scoringService');
const { assessHydration } = require('../services/hydrationService');

const buildSleepWindow = (baseDate) => {
  const sessionDate = new Date(baseDate);
  sessionDate.setHours(0, 0, 0, 0);

  // Broaden window: 12:00 PM (noon) to 12:00 PM next day.
  // The sleep boundary logic is time-independent and driven by physiology.
  const sleepStart = new Date(sessionDate);
  sleepStart.setHours(12, 0, 0, 0);

  const sleepEnd = new Date(sessionDate);
  sleepEnd.setDate(sleepEnd.getDate() + 1);
  sleepEnd.setHours(12, 0, 0, 0);

  return { sleepStart, sleepEnd, sessionDate };
};

/**
 * Returns the analysis target date.
 * Defaults to yesterday if no date query param is provided.
 *
 * @param {string|undefined} dateParam - Optional ISO date string from query
 * @returns {Date}
 */
const getTargetDate = (dateParam) => {
  if (dateParam) return new Date(dateParam);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
};

const getSleepReport = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    if (req.user._id.toString() !== user_id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetDate = getTargetDate(req.query.date);
    const { sleepStart: winStart, sleepEnd: winEnd, sessionDate } = buildSleepWindow(targetDate);

    // ── Engine Flow ────────────────────────────────────────────────────────────
    const thresholds = getThresholds(user.age);
    const baseline = await calculateBaseline(user_id, sessionDate);
    const epochs = await classifySleepStages(user_id, winStart, winEnd, baseline, thresholds);

    // Timeline Boundaries
    const detectedSleepStart = detectSleepStart(epochs) || new Date(epochs[0].start_time);
    const detectedWakeTime   = detectWakeTime(epochs) || new Date(epochs[epochs.length - 1].start_time);
    const durationMins       = Math.round((detectedWakeTime - detectedSleepStart) / 60000);

    // Scoring & Hydration
    const scoreData = computeSleepQuality(epochs, thresholds);
    const hydration = assessHydration(epochs);
    
    // Convert stage counts to percentages for integer stage_distribution payload
    const stageCounts = epochs.reduce((acc, e) => {
      acc[e.stage] = (acc[e.stage] || 0) + 1;
      return acc;
    }, { AWAKE: 0, N1: 0, N2: 0, N3: 0, REM: 0 });

    const totalEpochs = epochs.length;
    const stage_distribution = {
      AWAKE: Math.round((stageCounts.AWAKE / totalEpochs) * 100) || 0,
      N1:    Math.round((stageCounts.N1 / totalEpochs) * 100) || 0,
      N2:    Math.round((stageCounts.N2 / totalEpochs) * 100) || 0,
      N3:    Math.round((stageCounts.N3 / totalEpochs) * 100) || 0,
      REM:   Math.round((stageCounts.REM / totalEpochs) * 100) || 0,
    };

    // Format output times nicely for the JSON
    const fmtTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // ── Build Final Payload ───────────────────────────────────────────────────
    const payload = {
      user_age_group: thresholds.ageGroup.toUpperCase(),
      sleep_start: fmtTime(detectedSleepStart),
      wake_time: fmtTime(detectedWakeTime),
      sleep_duration_minutes: durationMins,
      sleep_quality_score: scoreData.sleep_quality_score, // 0-100
      sleep_quality: scoreData.sleep_quality,
      stage_distribution,
      dehydration_status: hydration.hydration_status,
      explanation: scoreData.explanation,
      suggestions: scoreData.suggestions
    };

    // Persist to DB
    await SleepAnalysis.findOneAndUpdate(
      { user_id, session_date: sessionDate },
      {
        user_id,
        session_date: sessionDate,
        user_age_group: payload.user_age_group,
        sleep_start: detectedSleepStart,
        wake_time: detectedWakeTime,
        sleep_duration_minutes: durationMins,
        sleep_quality_score: payload.sleep_quality_score,
        sleep_quality: payload.sleep_quality,
        stage_distribution: stageCounts,
        dehydration_status: payload.dehydration_status,
        explanation: payload.explanation,
        suggestions: payload.suggestions,
        baseline,
        sleep_stages: epochs
      },
      { upsert: true, new: true }
    );

    return res.status(200).json(payload);

  } catch (error) {
    if (error?.message?.includes('Insufficient pre-sleep data') || error?.message?.includes('No sensor data found')) {
      return res.status(422).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getSleepStages = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    if (req.user._id.toString() !== user_id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const targetDate = getTargetDate(req.query.date);
    const { sessionDate } = buildSleepWindow(targetDate);

    const doc = await SleepAnalysis.findOne({ user_id, session_date: sessionDate });
    if(!doc) {
       return res.status(404).json({ success: false, message: 'No sleep stages found. Call /sleep-report first.' });
    }

    res.status(200).json({ success: true, data: { sleep_stages: doc.sleep_stages } });
  } catch(e) { next(e); }
};

const getHydrationStatus = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    if (req.user._id.toString() !== user_id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const targetDate = getTargetDate(req.query.date);
    const { sessionDate } = buildSleepWindow(targetDate);

    const doc = await SleepAnalysis.findOne({ user_id, session_date: sessionDate });
    if(!doc) {
       return res.status(404).json({ success: false, message: 'No hydration data found. Call /sleep-report first.' });
    }

    res.status(200).json({ success: true, data: { dehydration_status: doc.dehydration_status } });
  } catch(e) { next(e); }
};

module.exports = { getSleepReport, getSleepStages, getHydrationStatus };
