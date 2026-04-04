/**
 * @file SleepAnalysis.js
 * @description Mongoose schema for storing the results of a full sleep session analysis.
 */

const mongoose = require('mongoose');

// ─── Sub-schema: Individual 30-second epoch ───────────────────────────────────
const EpochSchema = new mongoose.Schema(
  {
    epoch_index: { type: Number, required: true },
    start_time:  { type: Date,   required: true },
    end_time:    { type: Date,   required: true },
    stage:       {
      type: String,
      enum: ['AWAKE', 'REM', 'N1', 'N2', 'N3'],
      required: true,
    },
    // Raw deviations and calculated features for debugging / graphing
    cbt_norm:   { type: Number },
    hr_norm:    { type: Number },
    rr_norm:    { type: Number },
    skin_norm:  { type: Number },
    move_norm:  { type: Number },
    cbt_slope:  { type: Number },
    hr_slope:   { type: Number },
    rr_var:     { type: Number },
    move_spike: { type: Number },
    epoch_score:{ type: Number }, // Quality points for this epoch
  },
  { _id: false }
);

// ─── Sub-schema: Adaptive Baseline ────────────────────────────────────────────
const BaselineSchema = new mongoose.Schema(
  {
    cbt_base:       { type: Number },
    hr_base:        { type: Number },
    rr_base:        { type: Number },
    skin_base:      { type: Number },
    movement_base:  { type: Number },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const SleepAnalysisSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    session_date: {
      type: Date,
      required: true,
    },
    user_age_group: {
      type: String,
      enum: ['CHILD', 'ADULT', 'AGING'],
    },
    
    // Bounds
    sleep_start: { type: Date },
    wake_time:   { type: Date },
    sleep_duration_minutes: { type: Number }, // Based on start -> wake

    // Analysis results
    sleep_quality_score: { type: Number },    // e.g. 82 (0-100 scale)
    sleep_quality: {
      type: String,
      enum: ['GOOD', 'MODERATE', 'POOR'],
    },
    stage_distribution: {
      AWAKE: { type: Number, default: 0 },
      N1:    { type: Number, default: 0 },
      N2:    { type: Number, default: 0 },
      N3:    { type: Number, default: 0 },
      REM:   { type: Number, default: 0 },
    },
    dehydration_status: {
      type: String,
    },
    
    // Text responses
    explanation:  { type: String },
    suggestions:  [{ type: String }],
    
    // Technical Data
    baseline: { type: BaselineSchema },
    sleep_stages: [EpochSchema],
  },
  {
    timestamps: true,
  }
);

SleepAnalysisSchema.index({ user_id: 1, session_date: -1 });

module.exports = mongoose.model('SleepAnalysis', SleepAnalysisSchema);
