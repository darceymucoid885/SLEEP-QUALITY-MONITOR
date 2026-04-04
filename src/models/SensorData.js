/**
 * @file SensorData.js
 * @description Mongoose schema for storing raw physiological sensor readings.
 * Each document represents a single timestamped data point from a sensor device.
 * Indexed on (user_id + timestamp) for efficient time-series queries.
 */

const mongoose = require('mongoose');

const SensorDataSchema = new mongoose.Schema(
  {
    // ─── Reference to User ──────────────────────────────────────────────────
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user_id is required'],
      index: true,
    },

    // ─── Timestamp of the sensor reading ────────────────────────────────────
    timestamp: {
      type: Date,
      required: [true, 'timestamp is required'],
      index: true,
    },

    // ─── Core Body Temperature (CBT) in Celsius ──────────────────────────────
    // Normal human range: 36.0°C – 37.5°C
    cbt: {
      type: Number,
      required: [true, 'Core Body Temperature (cbt) is required'],
      min: [30.0, 'CBT too low — must be > 30°C'],
      max: [42.0, 'CBT too high — must be < 42°C'],
    },

    // ─── Heart Rate in BPM ────────────────────────────────────────────────────
    // Normal resting range: 40–100 BPM
    heart_rate: {
      type: Number,
      required: [true, 'heart_rate is required'],
      min: [20, 'Heart rate too low'],
      max: [220, 'Heart rate too high'],
    },

    // ─── Respiration Rate in breaths per minute ──────────────────────────────
    // Normal range: 10–25 breaths/min
    respiration_rate: {
      type: Number,
      required: [true, 'respiration_rate is required'],
      min: [4, 'Respiration rate too low'],
      max: [60, 'Respiration rate too high'],
    },

    // ─── Skin Temperature in Celsius (wrist/finger sensor) ───────────────────
    // Typically 32°C – 36°C, rises ~0.4–1°C during early sleep
    skin_temp: {
      type: Number,
      required: [true, 'skin_temp is required'],
      min: [25.0, 'Skin temperature too low'],
      max: [40.0, 'Skin temperature too high'],
    },

    // ─── Movement Score (0.0 = perfectly still, 1.0 = fully active) ──────────
    movement: {
      type: Number,
      required: [true, 'movement is required'],
      min: [0.0, 'Movement must be 0 or greater'],
      max: [1.0, 'Movement must be 1 or less'],
    },
  },
  {
    timestamps: true,  // Document creation/update tracking
  }
);

// ─── Compound Index for Fast Time-Series Queries ──────────────────────────────
// Used heavily by the baseline engine and stage classifier
SensorDataSchema.index({ user_id: 1, timestamp: 1 });

module.exports = mongoose.model('SensorData', SensorDataSchema);
