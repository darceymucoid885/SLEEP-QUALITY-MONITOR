/**
 * @file User.js
 * @description Mongoose schema and model for User accounts.
 * Supports Email+Password, Mobile+OTP, and Google OAuth authentication.
 * Passwords are pre-hashed using bcryptjs before saving to the database.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    // ─── Identity Fields ────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [1, 'Age must be at least 1'],
      max: [120, 'Age must be at most 120'],
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', null],
      default: null,  // Optional field
    },

    // ─── Authentication: Email + Password ───────────────────────────────────
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,  // Allow multiple null values (users who login via mobile/Google)
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,  // Hide password hash from queries by default
    },

    // ─── Authentication: Mobile + OTP ───────────────────────────────────────
    mobile: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,  // Allow multiple null values
      match: [/^\+?[1-9]\d{9,14}$/, 'Please provide a valid mobile number'],
    },
    otp: {
      type: String,
      select: false,  // Never expose OTP in API responses
    },
    otpExpiry: {
      type: Date,
      select: false,
    },

    // ─── Authentication: Google OAuth ───────────────────────────────────────
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // ─── Profile State ──────────────────────────────────────────────────────
    isVerified: {
      type: Boolean,
      default: false,  // True after email/mobile verification
    },
    authMethod: {
      type: String,
      enum: ['email', 'mobile', 'google'],
      required: true,
    },
  },
  {
    timestamps: true,  // Adds createdAt and updatedAt automatically
  }
);

// ─── Pre-Save Hook: Hash Password Before Storing ──────────────────────────────
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password') || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(10);  // Cost factor 10 — good balance of speed/security
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ─── Instance Method: Compare Password ───────────────────────────────────────
/**
 * Compares a plaintext candidate password against the stored hash.
 * @param {string} candidatePassword - The password string to verify
 * @returns {Promise<boolean>} True if the password matches
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Age Group Helper ─────────────────────────────────────────────────────────
/**
 * Returns the age group based on the user's age.
 * Used by the threshold engine to determine physiological norms.
 * @returns {'child'|'adult'|'aging'}
 */
UserSchema.methods.getAgeGroup = function () {
  if (this.age <= 12) return 'child';
  if (this.age <= 40) return 'adult';
  return 'aging';
};

module.exports = mongoose.model('User', UserSchema);
