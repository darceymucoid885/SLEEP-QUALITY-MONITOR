/**
 * @file validateMiddleware.js
 * @description Input Validation Middleware using express-validator.
 *
 * Provides validation rule sets for each major API endpoint.
 * Each exported array contains validation chains followed by a
 * handleValidationErrors middleware that short-circuits the request
 * if any validation rules fail.
 */

const { body, param, validationResult } = require('express-validator');

// ─── Error Handler ────────────────────────────────────────────────────────────
/**
 * Middleware to collect express-validator errors and return them as a structured
 * 422 response if any validation rule fails.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed. Please check your input.',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  next();
};

// ─── Auth: Register Validation ────────────────────────────────────────────────
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 100 }).withMessage('Name must not exceed 100 characters.'),

  body('age')
    .notEmpty().withMessage('Age is required.')
    .isInt({ min: 1, max: 120 }).withMessage('Age must be a number between 1 and 120.'),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other.'),

  body('auth_method')
    .notEmpty().withMessage('auth_method is required.')
    .isIn(['email', 'mobile', 'google']).withMessage("auth_method must be 'email', 'mobile', or 'google'."),

  // Email is required only when auth_method is 'email'
  body('email')
    .if(body('auth_method').equals('email'))
    .notEmpty().withMessage('Email is required for email authentication.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  // Password is required only when auth_method is 'email'
  body('password')
    .if(body('auth_method').equals('email'))
    .notEmpty().withMessage('Password is required for email authentication.')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),

  // Mobile is required when auth_method is 'mobile'
  body('mobile')
    .if(body('auth_method').equals('mobile'))
    .notEmpty().withMessage('Mobile number is required for mobile authentication.')
    .matches(/^\+?[1-9]\d{9,14}$/).withMessage('Please provide a valid international mobile number (e.g., +919876543210).'),

  // Google ID is required when auth_method is 'google'
  body('google_id')
    .if(body('auth_method').equals('google'))
    .notEmpty().withMessage('google_id is required for Google OAuth authentication.'),

  handleValidationErrors,
];

// ─── Auth: Login Validation ───────────────────────────────────────────────────
const validateLogin = [
  body('auth_method')
    .notEmpty().withMessage('auth_method is required.')
    .isIn(['email', 'mobile', 'google']).withMessage("auth_method must be 'email', 'mobile', or 'google'."),

  body('email')
    .if(body('auth_method').equals('email'))
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email.'),

  body('password')
    .if(body('auth_method').equals('email'))
    .notEmpty().withMessage('Password is required.'),

  body('mobile')
    .if(body('auth_method').equals('mobile'))
    .notEmpty().withMessage('Mobile number is required.'),

  body('otp')
    .if(body('auth_method').equals('mobile'))
    .notEmpty().withMessage('OTP is required.')
    .isLength({ min: 4, max: 8 }).withMessage('OTP must be 4–8 characters.'),

  handleValidationErrors,
];

// ─── Sensor Data Ingestion Validation ────────────────────────────────────────
const validateSensorData = [
  body('user_id')
    .notEmpty().withMessage('user_id is required.')
    .isMongoId().withMessage('user_id must be a valid MongoDB ObjectId.'),

  body('timestamp')
    .notEmpty().withMessage('timestamp is required.')
    .isISO8601().withMessage('timestamp must be a valid ISO 8601 date string.'),

  body('cbt')
    .notEmpty().withMessage('cbt (Core Body Temperature) is required.')
    .isFloat({ min: 30.0, max: 42.0 }).withMessage('CBT must be between 30.0°C and 42.0°C.'),

  body('heart_rate')
    .notEmpty().withMessage('heart_rate is required.')
    .isInt({ min: 20, max: 220 }).withMessage('Heart rate must be between 20 and 220 BPM.'),

  body('respiration_rate')
    .notEmpty().withMessage('respiration_rate is required.')
    .isFloat({ min: 4, max: 60 }).withMessage('Respiration rate must be between 4 and 60 breaths/min.'),

  body('skin_temp')
    .notEmpty().withMessage('skin_temp is required.')
    .isFloat({ min: 25.0, max: 40.0 }).withMessage('Skin temperature must be between 25.0°C and 40.0°C.'),

  body('movement')
    .notEmpty().withMessage('movement is required.')
    .isFloat({ min: 0.0, max: 1.0 }).withMessage('Movement must be a normalized value between 0.0 and 1.0.'),

  handleValidationErrors,
];

// ─── URL Param: Validate User ID ──────────────────────────────────────────────
const validateUserId = [
  param('user_id')
    .isMongoId().withMessage('user_id in URL must be a valid MongoDB ObjectId.'),
  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateSensorData,
  validateUserId,
};
