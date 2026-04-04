/**
 * @file HydrationRecord.js
 * @description Mongoose schema for storing dehydration assessment results.
 * One document per user per sleep session analysis.
 * Derived from CBT, skin temperature, and heart rate patterns during sleep.
 *
 * NOTE: This model exists for future standalone hydration report endpoints.
 * Currently, the dehydration_status string is embedded directly in SleepAnalysis.
 */

const mongoose = require('mongoose');

const HydrationRecordSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Links back to the specific sleep analysis session
    analysis_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SleepAnalysis',
      required: true,
    },

    session_date: {
      type: Date,
      required: true,
    },

    // ─── Hydration Classification ────────────────────────────────────────────
    hydration_status: {
      type: String,
      enum: ['NORMAL', 'MILD_DEHYDRATION', 'SEVERE_DEHYDRATION'],
      required: true,
    },

    // ─── Indicator Flags (what triggered the classification) ─────────────────
    indicators: {
      cbt_not_dropping:  { type: Boolean, default: false },
      skin_not_rising:   { type: Boolean, default: false },
      hr_elevated:       { type: Boolean, default: false },
    },

    // ─── Explanation and Recommendations ─────────────────────────────────────
    explanation: { type: String },
    suggestions:  [{ type: String }],
  },
  {
    timestamps: true,
  }
);

HydrationRecordSchema.index({ user_id: 1, session_date: -1 });

module.exports = mongoose.model('HydrationRecord', HydrationRecordSchema);
