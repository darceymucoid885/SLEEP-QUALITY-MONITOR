/**
 * @file authController.js
 * @description Authentication Controller.
 *
 * Handles user registration and login for three authentication methods:
 *   1. Email + Password
 *   2. Mobile + OTP (OTP generation is mocked — integrate Twilio in production)
 *   3. Google OAuth (token-based — accepts google_id from client)
 *
 * All successful logins return a signed JWT token.
 */

const User = require('../models/User');
const { generateToken } = require('../middleware/authMiddleware');

// ─── Utility: Format User Response ───────────────────────────────────────────
/**
 * Returns a safe user object without sensitive fields.
 * @param {object} user - Mongoose User document
 * @returns {object} Clean user profile
 */
const formatUser = (user) => ({
  id:          user._id,
  name:        user.name,
  age:         user.age,
  gender:      user.gender,
  email:       user.email,
  mobile:      user.mobile,
  auth_method: user.authMethod,
  is_verified: user.isVerified,
  age_group:   user.getAgeGroup(),
});

// ─── OTP Utilities (Mocked — replace with Twilio/SMS provider) ───────────────
/**
 * Generates a random 6-digit OTP.
 * In production: send this via Twilio/SMS.
 * @returns {string} 6-digit OTP as string
 */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── POST /auth/register ──────────────────────────────────────────────────────
/**
 * Registers a new user account.
 *
 * Supports three auth methods:
 *   - 'email': Requires email + password. Creates account immediately.
 *   - 'mobile': Requires mobile number. Generates OTP (mocked).
 *   - 'google': Requires google_id from the Google OAuth client.
 *
 * @route  POST /auth/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { name, age, gender, auth_method, email, password, mobile, google_id } = req.body;

    let user;

    // ── Email + Password Registration ──────────────────────────────────────
    if (auth_method === 'email') {
      // Check if email is already in use
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'This email address is already registered. Please log in.',
        });
      }

      user = await User.create({
        name,
        age,
        gender: gender || null,
        email,
        password,  // Hashed by pre-save hook in User model
        authMethod: 'email',
        isVerified: false, // Email verification flow can be added here
      });

      const token = generateToken(user._id);
      return res.status(201).json({
        success: true,
        message: 'Account registered successfully. Please verify your email.',
        data: { token, user: formatUser(user) },
      });
    }

    // ── Mobile + OTP Registration ──────────────────────────────────────────
    if (auth_method === 'mobile') {
      const existing = await User.findOne({ mobile });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'This mobile number is already registered.',
        });
      }

      const otp = generateOTP();
      const otpExpiry = new Date(
        Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000
      );

      user = await User.create({
        name,
        age,
        gender: gender || null,
        mobile,
        otp,         // Stored (hashed in production — use bcrypt for OTP too)
        otpExpiry,
        authMethod: 'mobile',
        isVerified: false,
      });

      // TODO: Send OTP via SMS provider: await sendSMS(mobile, `Your OTP: ${otp}`);
      console.log(`📱 [MOCK OTP] Mobile: ${mobile} → OTP: ${otp}`); // Remove in production

      return res.status(201).json({
        success: true,
        message: `OTP sent to ${mobile}. Please verify to complete registration.`,
        data: {
          user_id: user._id,
          // In development only — remove in production
          ...(process.env.NODE_ENV === 'development' && { otp_debug: otp }),
        },
      });
    }

    // ── Google OAuth Registration ──────────────────────────────────────────
    if (auth_method === 'google') {
      const existing = await User.findOne({ googleId: google_id });
      if (existing) {
        // Already registered — just issue a token (idempotent)
        const token = generateToken(existing._id);
        return res.status(200).json({
          success: true,
          message: 'Google account already registered. Logging in.',
          data: { token, user: formatUser(existing) },
        });
      }

      user = await User.create({
        name,
        age,
        gender: gender || null,
        googleId: google_id,
        authMethod: 'google',
        isVerified: true,  // Google accounts are pre-verified by Google
      });

      const token = generateToken(user._id);
      return res.status(201).json({
        success: true,
        message: 'Google account registered successfully.',
        data: { token, user: formatUser(user) },
      });
    }

    // Should not reach here (caught by validator), but as a safeguard:
    return res.status(400).json({ success: false, message: 'Invalid auth_method.' });

  } catch (error) {
    next(error);
  }
};

// ─── POST /auth/login ─────────────────────────────────────────────────────────
/**
 * Authenticates an existing user and returns a JWT.
 *
 * @route  POST /auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { auth_method, email, password, mobile, otp, google_id } = req.body;

    // ── Email + Password Login ─────────────────────────────────────────────
    if (auth_method === 'email') {
      // Explicitly include password for comparison (select: false in schema)
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      const token = generateToken(user._id);
      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: { token, user: formatUser(user) },
      });
    }

    // ── Mobile + OTP Login ─────────────────────────────────────────────────
    if (auth_method === 'mobile') {
      const user = await User.findOne({ mobile }).select('+otp +otpExpiry');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Mobile number not registered. Please sign up first.',
        });
      }

      // Check if OTP has expired
      if (!user.otp || !user.otpExpiry || new Date() > user.otpExpiry) {
        return res.status(401).json({
          success: false,
          message: 'OTP has expired. Please request a new OTP.',
        });
      }

      // Validate OTP
      if (user.otp !== otp) {
        return res.status(401).json({
          success: false,
          message: 'Invalid OTP. Please try again.',
        });
      }

      // Clear OTP after successful use (single-use token)
      user.otp      = undefined;
      user.otpExpiry = undefined;
      user.isVerified = true;
      await user.save({ validateBeforeSave: false });

      const token = generateToken(user._id);
      return res.status(200).json({
        success: true,
        message: 'OTP verified. Login successful.',
        data: { token, user: formatUser(user) },
      });
    }

    // ── Google OAuth Login ────────────────────────────────────────────────
    if (auth_method === 'google') {
      const user = await User.findOne({ googleId: google_id });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Google account not registered. Please sign up first.',
        });
      }

      const token = generateToken(user._id);
      return res.status(200).json({
        success: true,
        message: 'Google login successful.',
        data: { token, user: formatUser(user) },
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid auth_method.' });

  } catch (error) {
    next(error);
  }
};

// ─── POST /auth/send-otp ──────────────────────────────────────────────────────
/**
 * Sends a fresh OTP to a registered mobile number.
 * Used when OTP has expired during the login flow.
 *
 * @route  POST /auth/send-otp
 * @access Public
 */
const sendOtp = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required.' });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Mobile number not found. Please register first.',
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(
      Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000
    );

    user.otp      = otp;
    user.otpExpiry = otpExpiry;
    await user.save({ validateBeforeSave: false });

    // TODO: Send via SMS provider
    console.log(`📱 [MOCK OTP RESEND] Mobile: ${mobile} → OTP: ${otp}`);

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${mobile}.`,
      ...(process.env.NODE_ENV === 'development' && { otp_debug: otp }),
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, sendOtp };
