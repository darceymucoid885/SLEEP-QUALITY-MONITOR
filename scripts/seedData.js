/**
 * @file seedData.js
 * @description Mock data seeder for development and testing.
 *
 * Creates:
 *   1. A test user (adult, age 30)
 *   2. Pre-sleep baseline data (6PM–10PM)
 *   3. Full-night sleep data (10PM–7AM) simulating a real sleep cycle
 *      with realistic physiological patterns across all sleep stages.
 *
 * Run: npm run seed
 *
 * ⚠️  WARNING: This script drops and recreates SensorData for the test user.
 *              Do not run against a production database.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const SensorData = require('../src/models/SensorData');

// ─── Connection ───────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('✅ Connected to MongoDB for seeding...');
  seed();
}).catch((err) => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});

// ─── Utility: Random float within range ──────────────────────────────────────
const rand = (min, max, decimals = 2) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));

// ─── Utility: Add minutes to a Date ──────────────────────────────────────────
const addMinutes = (date, mins) => new Date(date.getTime() + mins * 60 * 1000);
const addSeconds = (date, sec) => new Date(date.getTime() + sec * 1000);

// ─── Main Seed Function ───────────────────────────────────────────────────────
async function seed() {
  try {
    // ── Step 1: Create or Find Test User ─────────────────────────────────────
    let user = await User.findOne({ email: 'testuser@sleep.dev' });

    if (!user) {
      user = await User.create({
        name:       'Raj Kumar',
        age:        30,
        gender:     'male',
        email:      'testuser@sleep.dev',
        password:   'password123',  // Will be hashed by pre-save hook
        authMethod: 'email',
        isVerified: true,
      });
      console.log(`👤 Test user created: ${user.name} (ID: ${user._id})`);
    } else {
      console.log(`👤 Using existing test user: ${user.name} (ID: ${user._id})`);
    }

    // ── Step 2: Clear existing sensor data for this user ──────────────────
    const deleted = await SensorData.deleteMany({ user_id: user._id });
    console.log(`🗑️  Cleared ${deleted.deletedCount} existing sensor records.`);

    // ── Step 3: Generate Pre-Sleep Baseline Data (6:00 PM – 10:00 PM) ─────
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() - 1);  // Yesterday
    sessionDate.setHours(0, 0, 0, 0);

    const preSleepStart = new Date(sessionDate);
    preSleepStart.setHours(18, 0, 0, 0);  // 6:00 PM

    const preSleepRecords = [];
    // Generate one reading every 5 minutes for 4 hours = 48 readings
    for (let i = 0; i < 48; i++) {
      const ts = addMinutes(preSleepStart, i * 5);
      preSleepRecords.push({
        user_id:          user._id,
        timestamp:        ts,
        cbt:              rand(36.8, 37.2),     // Normal awake CBT
        heart_rate:       Math.round(rand(65, 75)),
        respiration_rate: rand(14, 18),
        skin_temp:        rand(33.5, 34.5),
        movement:         rand(0.1, 0.4),       // Awake — moderate movement
      });
    }
    await SensorData.insertMany(preSleepRecords);
    console.log(`📊 Inserted ${preSleepRecords.length} pre-sleep baseline readings (6PM–10PM).`);

    // ── Step 4: Generate Full-Night Sleep Data (10:00 PM – 7:00 AM) ──────
    // Simulates a realistic sleep architecture cycle:
    //  N1 → N2 → N3 → N2 → REM → N2 → N3 → N2 → REM → AWAKE

    const sleepStart = new Date(sessionDate);
    sleepStart.setHours(22, 0, 0, 0);  // 10:00 PM

    const sleepRecords = [];
    let ts = sleepStart;

    // Helper: push a reading every 30 seconds within a segment
    const pushSegment = (durationMins, physiologyFn) => {
      const readings = (durationMins * 60) / 30;
      for (let i = 0; i < readings; i++) {
        sleepRecords.push({
          user_id: user._id,
          timestamp: ts,
          ...physiologyFn(i),
        });
        ts = addSeconds(ts, 30);
      }
    };

    // ─ Sleep Onset / N1 (20 mins) ────────────────────────────────────────
    pushSegment(20, (i) => ({
      cbt:              rand(36.5, 36.8),      // Slight drop
      heart_rate:       Math.round(rand(60, 68)),
      respiration_rate: rand(13, 17),
      skin_temp:        rand(34.0, 34.8),      // Slight rise
      movement:         rand(0.05, 0.18),      // Low
    }));

    // ─ N2 Light Sleep (30 mins) ──────────────────────────────────────────
    pushSegment(30, (i) => ({
      cbt:              rand(36.2, 36.5),      // Dropping more
      heart_rate:       Math.round(rand(55, 64)),
      respiration_rate: rand(12, 15),
      skin_temp:        rand(34.5, 35.2),
      movement:         rand(0.02, 0.09),      // Very low
    }));

    // ─ N3 Deep Sleep (45 mins) ──────────────────────────────────────────
    pushSegment(45, (i) => ({
      cbt:              rand(35.9, 36.1),      // Lowest CBT
      heart_rate:       Math.round(rand(48, 55)),  // Lowest HR
      respiration_rate: rand(11, 13),          // Slowest, very stable
      skin_temp:        rand(35.5, 36.0),      // Highest skin temp
      movement:         rand(0.0, 0.03),       // Near zero
    }));

    // ─ N2 Ascending (20 mins) ────────────────────────────────────────────
    pushSegment(20, (i) => ({
      cbt:              rand(36.0, 36.3),
      heart_rate:       Math.round(rand(56, 63)),
      respiration_rate: rand(12, 15),
      skin_temp:        rand(35.0, 35.5),
      movement:         rand(0.01, 0.08),
    }));

    // ─ First REM (50 mins) ────────────────────────────────────────────────
    pushSegment(50, (i) => ({
      cbt:              rand(36.3, 36.5),      // CBT flat/slight rise
      heart_rate:       Math.round(rand(58, 72)),  // Variable HR — defining REM feature
      respiration_rate: rand(12, 19),          // Irregular RR
      skin_temp:        rand(34.8, 35.3),
      movement:         rand(0.0, 0.07),       // Low movement
    }));

    // ─ N2 (25 mins) ──────────────────────────────────────────────────────
    pushSegment(25, (i) => ({
      cbt:              rand(36.0, 36.3),
      heart_rate:       Math.round(rand(54, 61)),
      respiration_rate: rand(12, 14),
      skin_temp:        rand(35.0, 35.6),
      movement:         rand(0.01, 0.06),
    }));

    // ─ Second N3 (35 mins) ────────────────────────────────────────────────
    pushSegment(35, (i) => ({
      cbt:              rand(35.8, 36.0),
      heart_rate:       Math.round(rand(46, 53)),
      respiration_rate: rand(11, 13),
      skin_temp:        rand(35.5, 36.1),
      movement:         rand(0.0, 0.03),
    }));

    // ─ Second REM (70 mins — longest REM towards morning) ────────────────
    pushSegment(70, (i) => ({
      cbt:              rand(36.2, 36.5),
      heart_rate:       Math.round(rand(60, 76)),  // Large variable range in REM
      respiration_rate: rand(12, 20),
      skin_temp:        rand(34.6, 35.2),
      movement:         rand(0.0, 0.08),
    }));

    // ─ N2 Final (20 mins) ─────────────────────────────────────────────────
    pushSegment(20, (i) => ({
      cbt:              rand(36.0, 36.4),
      heart_rate:       Math.round(rand(56, 65)),
      respiration_rate: rand(12, 15),
      skin_temp:        rand(35.0, 35.5),
      movement:         rand(0.01, 0.07),
    }));

    // ─ AWAKE Wake-Up (15 mins) ────────────────────────────────────────────
    // CBT rising, HR rising, movement increasing — wake detection pattern
    pushSegment(15, (i) => ({
      cbt:              rand(36.5, 36.9),      // CBT rising — wake signal
      heart_rate:       Math.round(rand(68, 78)),  // Rising HR
      respiration_rate: rand(15, 20),
      skin_temp:        rand(34.5, 35.0),
      movement:         rand(0.2, 0.5),        // Movement increasing
    }));

    await SensorData.insertMany(sleepRecords);
    console.log(`🌙 Inserted ${sleepRecords.length} sleep session readings (10PM–7AM).`);

    console.log('\n✅ Seed complete!');
    console.log(`\n📋 Test Credentials:`);
    console.log(`   Email: testuser@sleep.dev`);
    console.log(`   Password: password123`);
    console.log(`   User ID: ${user._id}`);
    console.log(`\n🔬 To run analysis: GET /sleep-report/${user._id}`);
    console.log(`   (after authenticating at POST /auth/login)\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}
