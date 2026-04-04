/**
 * @file dataRoutes.js
 * @description Sensor data ingestion route definitions.
 *
 * Protected endpoints — JWT required.
 *
 * Routes:
 *   POST /sensor-data         → Ingest a single sensor reading
 *   POST /sensor-data/batch   → Ingest a batch of sensor readings (up to 10,000)
 */

const express = require('express');
const router  = express.Router();

const { ingestSensorData, ingestBatchSensorData } = require('../controllers/dataController');
const { protect } = require('../middleware/authMiddleware');
const { validateSensorData } = require('../middleware/validateMiddleware');

// POST /sensor-data — single reading ingestion with full validation
router.post('/sensor-data', protect, validateSensorData, ingestSensorData);

// POST /sensor-data/batch — batch upload (no per-item validation; validated inline in controller)
router.post('/sensor-data/batch', protect, ingestBatchSensorData);

module.exports = router;
