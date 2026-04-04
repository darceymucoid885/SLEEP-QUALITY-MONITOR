/**
 * @file analysisRoutes.js
 * @description Sleep analysis and hydration report route definitions.
 *
 * All routes are protected (JWT required).
 * Authorization enforcement (user can only access own data) is done in the controller.
 *
 * Routes:
 *   GET /sleep-report/:user_id       → Full sleep analysis pipeline + report
 *   GET /sleep-stages/:user_id       → Pre-computed stage breakdown
 *   GET /hydration-status/:user_id   → Pre-computed hydration assessment
 */

const express = require('express');
const router  = express.Router();

const {
  getSleepReport,
  getSleepStages,
  getHydrationStatus,
} = require('../controllers/analysisController');

const { protect } = require('../middleware/authMiddleware');
const { validateUserId } = require('../middleware/validateMiddleware');

// GET /sleep-report/:user_id
// Triggers full pipeline: baseline → stages → score → hydration
router.get('/sleep-report/:user_id', protect, validateUserId, getSleepReport);

// GET /sleep-stages/:user_id
// Returns pre-computed epoch stage data from the DB
router.get('/sleep-stages/:user_id', protect, validateUserId, getSleepStages);

// GET /hydration-status/:user_id
// Returns pre-computed hydration classification from the DB
router.get('/hydration-status/:user_id', protect, validateUserId, getHydrationStatus);

module.exports = router;
