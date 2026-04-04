/**
 * @file dataController.js
 * @description Sensor Data Ingestion Controller.
 *
 * Handles the POST /sensor-data endpoint.
 * Accepts physiological sensor readings and stores them in MongoDB.
 * This is the real-time data ingestion point — designed for high-frequency calls.
 *
 * After storing, it optionally triggers an asynchronous analysis update if
 * a session boundary (e.g., end of sleep) is detected — but for real-time
 * streaming scenarios, analysis is deferred to the report endpoints.
 */

const SensorData = require('../models/SensorData');
const User = require('../models/User');
const Alert = require('../models/Alert');
const { evaluateDaytimeHydration } = require('../services/realtimeHydrationService');

// ─── POST /sensor-data ────────────────────────────────────────────────────────
/**
 * Ingests a single sensor reading for a user.
 *
 * Request Body:
 * {
 *   user_id,
 *   timestamp,
 *   cbt,
 *   heart_rate,
 *   respiration_rate,
 *   skin_temp,
 *   movement
 * }
 *
 * Validation is handled by validateSensorData middleware before reaching here.
 *
 * @route  POST /sensor-data
 * @access Private (JWT required)
 */
const ingestSensorData = async (req, res, next) => {
  try {
    const {
      user_id,
      timestamp,
      cbt,
      heart_rate,
      respiration_rate,
      skin_temp,
      movement,
    } = req.body;

    // ─── Authorization Check ────────────────────────────────────────────────
    // Ensure the authenticated user is only submitting data for themselves.
    // Admin bypass could be added here in the future.
    if (req.user._id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only submit sensor data for your own account.',
      });
    }

    // ─── Verify User Exists ────────────────────────────────────────────────
    // (Belt-and-suspenders — JWT already verifies user exists, but protects
    // against edge cases like user deleted mid-session)
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // ─── Duplicate Prevention ──────────────────────────────────────────────
    // Prevent inserting duplicate readings for the exact same timestamp
    const existing = await SensorData.findOne({
      user_id,
      timestamp: new Date(timestamp),
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A sensor reading with this exact timestamp already exists.',
        data: existing,
      });
    }

    // ─── Persist Sensor Reading ───────────────────────────────────────────
    const sensorRecord = await SensorData.create({
      user_id,
      timestamp: new Date(timestamp),
      cbt,
      heart_rate,
      respiration_rate,
      skin_temp,
      movement,
    });


    // ─── Real-Time Daytime Dehydration Check ────────────────────────────────
    // Fast non-blocking check for real-time alerts
    setImmediate(async () => {
      try {
        const fifteenMinsAgo = new Date(new Date(timestamp).getTime() - 15 * 60000);
        const recentReadings = await SensorData.find({
          user_id,
          timestamp: { $gte: fifteenMinsAgo, $lte: new Date(timestamp) }
        }).sort({ timestamp: 1 });

        const alertResult = evaluateDaytimeHydration(recentReadings);

        if (alertResult && alertResult.type !== 'MEDICAL_FLAG') {
          // Prevent spam: only alert once per 30 mins for the same type
          const recentAlert = await Alert.findOne({
            user_id,
            alert_type: alertResult.type,
            created_at: { $gte: new Date(Date.now() - 30 * 60000) }
          });

          if (!recentAlert) {
            const newAlert = await Alert.create({
              user_id,
              alert_type: alertResult.type,
              score: alertResult.score || 0,
              message: alertResult.message
            });
            
            // Emit via WebSocket
            const io = req.app.get('io');
            if (io) {
              io.to(user_id.toString()).emit('hydration_alert', {
                id: newAlert._id,
                type: newAlert.alert_type,
                message: newAlert.message,
                timestamp: newAlert.created_at
              });
            }
          }
        }
      } catch (err) {
        console.error('Daytime hydration check failed:', err);
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Sensor data recorded successfully.',
      data: {
        id:                sensorRecord._id,
        user_id:           sensorRecord.user_id,
        timestamp:         sensorRecord.timestamp,
        cbt:               sensorRecord.cbt,
        heart_rate:        sensorRecord.heart_rate,
        respiration_rate:  sensorRecord.respiration_rate,
        skin_temp:         sensorRecord.skin_temp,
        movement:          sensorRecord.movement,
      },
    });

  } catch (error) {
    next(error);
  }
};

// ─── POST /sensor-data/batch ──────────────────────────────────────────────────
/**
 * Ingests a batch of sensor readings at once.
 * Useful for bulk uploading a full night of sensor data.
 *
 * Request Body: { user_id, readings: [...] }
 *   Each reading in 'readings' must match the single ingest format.
 *
 * Uses insertMany with ordered:false to continue on duplicates.
 *
 * @route  POST /sensor-data/batch
 * @access Private (JWT required)
 */
const ingestBatchSensorData = async (req, res, next) => {
  try {
    const { user_id, readings } = req.body;

    if (!user_id || !Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'user_id and a non-empty readings array are required.',
      });
    }

    // Authorization check
    if (req.user._id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only submit sensor data for your own account.',
      });
    }

    // Validate array size limit (prevent abuse)
    if (readings.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Batch size exceeds maximum limit of 10,000 readings per request.',
      });
    }

    // Prepare documents
    const documents = readings.map((r) => ({
      user_id,
      timestamp:        new Date(r.timestamp),
      cbt:              r.cbt,
      heart_rate:       r.heart_rate,
      respiration_rate: r.respiration_rate,
      skin_temp:        r.skin_temp,
      movement:         r.movement,
    }));

    // Insert with ordered:false so duplicate key errors don't stop remaining inserts
    const result = await SensorData.insertMany(documents, {
      ordered: false,
    }).catch((err) => {
      if (err.code === 11000) {
        // Some duplicates — return partial success info
        return {
          insertedCount: err.result?.nInserted || 0,
          hasDuplicates: true,
        };
      }
      throw err;
    });


    // ─── Real-Time Daytime Dehydration Check (Batch) ────────────────────────
    setImmediate(async () => {
      try {
        // Find the latest timestamp in the batch
        const latestTimestamp = new Date(Math.max(...readings.map(r => new Date(r.timestamp))));
        const fifteenMinsAgo = new Date(latestTimestamp.getTime() - 15 * 60000);
        
        const recentReadings = await SensorData.find({
          user_id,
          timestamp: { $gte: fifteenMinsAgo, $lte: latestTimestamp }
        }).sort({ timestamp: 1 });

        const alertResult = evaluateDaytimeHydration(recentReadings);
        
        if (alertResult && alertResult.type !== 'MEDICAL_FLAG') {
          const recentAlert = await Alert.findOne({
            user_id,
            alert_type: alertResult.type,
            created_at: { $gte: new Date(Date.now() - 30 * 60000) }
          });

          if (!recentAlert) {
            const newAlert = await Alert.create({
              user_id,
              alert_type: alertResult.type,
              score: alertResult.score || 0,
              message: alertResult.message
            });
            
            const io = req.app.get('io');
            if (io) {
              io.to(user_id.toString()).emit('hydration_alert', {
                id: newAlert._id,
                type: newAlert.alert_type,
                message: newAlert.message,
                timestamp: newAlert.created_at
              });
            }
          }
        }
      } catch (err) {
        console.error('Batch daytime hydration check failed:', err);
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Batch sensor data processed.',
      data: {
        inserted: result.insertedCount !== undefined ? result.insertedCount : documents.length,
        total_submitted: readings.length,
        ...(result.hasDuplicates && { notice: 'Some readings were skipped due to duplicate timestamps.' }),
      },
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { ingestSensorData, ingestBatchSensorData };
