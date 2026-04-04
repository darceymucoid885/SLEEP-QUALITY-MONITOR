/**
 * @file authRoutes.js
 * @description Authentication route definitions.
 *
 * Public endpoints — no JWT required.
 *
 * Routes:
 *   POST /auth/register   → Register a new user (email, mobile, or Google)
 *   POST /auth/login      → Login and receive a JWT
 *   POST /auth/send-otp   → Request a fresh OTP for mobile authentication
 */

const express = require('express');
const router  = express.Router();

const { register, login, sendOtp } = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validateMiddleware');

// POST /auth/register
router.post('/register', validateRegister, register);

// POST /auth/login
router.post('/login', validateLogin, login);

// POST /auth/send-otp  (resend OTP for expired/not-received cases)
router.post('/send-otp', sendOtp);

module.exports = router;
