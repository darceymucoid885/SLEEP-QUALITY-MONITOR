/**
 * @file authMiddleware.js
 * @description JWT Authentication Middleware.
 *
 * Verifies the Bearer token in the Authorization header on every
 * protected route. Attaches the decoded user payload to req.user
 * so downstream controllers can identify the requester.
 *
 * Usage: app.get('/protected', protect, controller)
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Express middleware that validates JWT tokens.
 *
 * Expected Header format:
 *   Authorization: Bearer <token>
 *
 * On success: populates req.user with the user document (without password).
 * On failure: responds with 401 Unauthorized.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const protect = async (req, res, next) => {
  let token;

  // Extract Bearer token from Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided. Please log in.',
    });
  }

  try {
    // Verify token signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach fresh user document from DB (ensures token is not for a deleted user)
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is valid but the user no longer exists.',
      });
    }

    req.user = user;  // Attach user to request for use in controllers
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }
    // Unexpected error
    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
    });
  }
};

/**
 * Generates a signed JWT token for a user ID.
 *
 * @param {string} userId - MongoDB ObjectId string
 * @returns {string} Signed JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = { protect, generateToken };
