/**
 * @file Alert.js
 * @description Mongoose schema for storing real-time dehydration alerts.
 * One document per alert event triggered during sensor ingestion.
 * Alerts are deduplicated within 30-minute cooldown windows before persisting.
 */

const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    alert_type: {
      type: String,
      enum: ['MILD_RISK', 'HIGH_RISK'],
      required: true,
    },
    score: {
      type: Number,
      required: false,
    },
    message: {
      type: String,
      required: true,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Index for efficient querying of recent alerts per user
AlertSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model('Alert', AlertSchema);
