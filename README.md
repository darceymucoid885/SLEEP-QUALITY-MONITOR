# SLEEP-QUALITY-MONITOR
Personal Sleep Quality & Physiological Monitoring System. A high-performance, deterministic physiological analysis engine and dashboard designed to monitor sleep quality and hydration strain using multi-sensor data. This system transforms raw biometric streams (CBT, HRV, Respiration) into actionable health insights using age-adaptive threshold models.

---

# Sleep Monitoring Dashboard — Backend API

A production-ready backend for a **Sleep Monitoring Dashboard** built with **Node.js + Express + MongoDB**.  
Features real-time physiological data processing and **deterministic rule-based sleep analysis** (no machine learning).

---

## 📁 Project Structure

```
sleep-monitoring-backend/
├── src/
│   ├── config/
│   │   └── db.js                 ← MongoDB connection
│   ├── controllers/
│   │   ├── authController.js     ← Register, Login (Email/Mobile/Google)
│   │   ├── dataController.js     ← Sensor data ingestion
│   │   └── analysisController.js ← Sleep report, stages, hydration
│   ├── middleware/
│   │   ├── authMiddleware.js     ← JWT verification + token generation
│   │   └── validateMiddleware.js ← express-validator rule sets
│   ├── models/
│   │   ├── User.js               ← User schema (multi-auth)
│   │   ├── SensorData.js         ← Time-series physiological readings
│   │   ├── SleepAnalysis.js      ← Session results + epoch stages
│   │   └── HydrationStatus.js    ← Dehydration classification
│   ├── routes/
│   │   ├── authRoutes.js         ← /auth/*
│   │   ├── dataRoutes.js         ← /sensor-data
│   │   └── analysisRoutes.js     ← /sleep-report, /sleep-stages, /hydration-status
│   ├── services/
│   │   ├── thresholdsService.js  ← Age-based physiological thresholds
│   │   ├── baselineService.js    ← Median-based adaptive baseline (6–10 PM)
│   │   ├── sleepStageService.js  ← 30-sec epoch rule-based classifier
│   │   ├── scoringService.js     ← Quality score + wake detection
│   │   └── hydrationService.js   ← Dehydration indicator logic
│   └── server.js                 ← Express entry point
├── scripts/
│   └── seedData.js               ← Mock data generator for testing
├── .env                          ← Environment config (see below)
└── package.json
```

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js v18+
- MongoDB (local: `mongodb://localhost:27017` or MongoDB Atlas)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Edit the `.env` file in the root directory:
```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/sleep_monitoring_db
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
OTP_EXPIRY_MINUTES=10
```

### 4. Run in Development
```bash
npm run dev
```

### 5. Seed Mock Data (optional)
Generates a realistic full-night sleep cycle for testing:
```bash
npm run seed
```

---

## 🔐 Authentication APIs

### POST /auth/register
Register using Email+Password, Mobile+OTP, or Google OAuth.

**Email Registration**
```json
POST /auth/register
{
  "name": "Raj Kumar",
  "age": 30,
  "gender": "male",
  "auth_method": "email",
  "email": "raj@example.com",
  "password": "securepass123"
}
```
**Response (201)**
```json
{
  "success": true,
  "message": "Account registered successfully.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "663f4c2a1b2e3f001d2e4567",
      "name": "Raj Kumar",
      "age": 30,
      "gender": "male",
      "email": "raj@example.com",
      "auth_method": "email",
      "age_group": "adult"
    }
  }
}
```

---

## 📡 Sensor Data API

### POST /sensor-data
> **Authorization**: `Bearer <jwt_token>`

```json
POST /sensor-data
{
  "user_id": "663f4c2a1b2e3f001d2e4567",
  "timestamp": "2025-01-15T23:00:00.000Z",
  "cbt": 36.4,
  "heart_rate": 58,
  "respiration_rate": 13.5,
  "skin_temp": 35.1,
  "movement": 0.02
}
```

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| express | HTTP framework |
| mongoose | MongoDB ODM |
| bcryptjs | Password hashing |
| jsonwebtoken | JWT auth |
| express-validator | Input validation |
| cors | CORS handling |
| dotenv | Environment variable loading |
| nodemon (dev) | Auto-reload in development |
