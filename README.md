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
PORT=5000
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

**Mobile Registration**
```json
POST /auth/register
{
  "name": "Priya S",
  "age": 45,
  "auth_method": "mobile",
  "mobile": "+919876543210"
}
```
> OTP is logged to console in development mode; integrate Twilio in production.

**Google Registration**
```json
POST /auth/register
{
  "name": "Amit T",
  "age": 10,
  "auth_method": "google",
  "google_id": "109341234567890"
}
```

---

### POST /auth/login
```json
POST /auth/login
{
  "auth_method": "email",
  "email": "raj@example.com",
  "password": "securepass123"
}
```
**Response (200)** — Same format as register.

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
**Response (201)**
```json
{
  "success": true,
  "message": "Sensor data recorded successfully.",
  "data": {
    "id": "663f5112abc123def456",
    "user_id": "663f4c2a1b2e3f001d2e4567",
    "timestamp": "2025-01-15T23:00:00.000Z",
    "cbt": 36.4,
    "heart_rate": 58,
    "respiration_rate": 13.5,
    "skin_temp": 35.1,
    "movement": 0.02
  }
}
```

### POST /sensor-data/batch
For bulk upload of pre-recorded sessions:
```json
{
  "user_id": "663f4c2a1b2e3f001d2e4567",
  "readings": [
    { "timestamp": "...", "cbt": 36.4, "heart_rate": 58, "respiration_rate": 13, "skin_temp": 35.1, "movement": 0.02 },
    ...
  ]
}
```

---

## 📊 Analysis APIs

> **Authorization**: `Bearer <jwt_token>`

### GET /sleep-report/:user_id
Runs the full pipeline on the previous night's data. Triggers baseline computation → stage classification → scoring → hydration assessment.

**Optional Query Params:**
- `?date=2025-01-15` — Analyze a specific date
- `?sleep_start=2025-01-15T22:00:00Z` — Override sleep window start
- `?sleep_end=2025-01-16T08:00:00Z` — Override sleep window end

**Sample Response (200)**
```json
{
  "success": true,
  "data": {
    "sleep_score": 7,
    "sleep_quality": "GOOD",
    "sleep_stages": [
      { "epoch_index": 0, "start_time": "2025-01-15T22:00:00Z", "end_time": "2025-01-15T22:00:30Z", "stage": "N1" },
      { "epoch_index": 1, "start_time": "2025-01-15T22:00:30Z", "end_time": "2025-01-15T22:01:00Z", "stage": "N2" },
      ...
    ],
    "stage_summary": [
      { "stage": "N1",    "duration_minutes": 18.0,  "percentage": 5.0 },
      { "stage": "N2",    "duration_minutes": 112.5, "percentage": 31.2 },
      { "stage": "N3",    "duration_minutes": 90.0,  "percentage": 25.0 },
      { "stage": "REM",   "duration_minutes": 120.0, "percentage": 33.3 },
      { "stage": "AWAKE", "duration_minutes": 20.0,  "percentage": 5.5 }
    ],
    "hydration_status": "NORMAL",
    "wake_time": "2025-01-16T06:45:00.000Z",
    "explanation": "Overall sleep quality was GOOD. Core body temperature dropped appropriately (+2). Heart rate dropped to a healthy resting level (+2). Respiration rate was stable (+1). Skin temperature rose appropriately (+1). Movement was low during sleep (+2).",
    "suggestions": [],
    "baseline": {
      "cbt_base": 37.0,
      "hr_base": 70.0,
      "rr_base": 16.0,
      "skin_base": 34.0,
      "movement_base": 0.2
    },
    "session_date": "2025-01-15T00:00:00.000Z",
    "age_group": "adult"
  }
}
```

### GET /sleep-stages/:user_id
Returns pre-computed stage data from the last analysis run.

### GET /hydration-status/:user_id
```json
{
  "success": true,
  "data": {
    "hydration_status": "MILD_DEHYDRATION",
    "indicators": {
      "cbt_not_dropping": true,
      "skin_not_rising": false,
      "hr_elevated": true
    },
    "explanation": "Mild dehydration detected. 2 of 3 dehydration indicators are present.",
    "suggestions": [
      "Drink 1–2 glasses of water in the hour before bedtime.",
      "Avoid alcohol and high-sodium foods close to sleep time."
    ]
  }
}
```

---

## 🧠 Rule-Based Engine Summary

### Age Groups & Thresholds
| Parameter | Child (≤12) | Adult (13–40) | Aging (>40) |
|-----------|-------------|----------------|-------------|
| CBT drop threshold | 0.3°C | 0.4°C | 0.3°C |
| HR drop threshold | 10 BPM | 8 BPM | 6 BPM |
| RR normal range | 15–25 | 12–20 | 12–20 |
| Skin rise threshold | 0.3°C | 0.4°C | 0.3°C |
| High movement threshold | 0.35 | 0.30 | 0.25 |

### Sleep Stage Priority
1. **AWAKE** — High movement OR HR above baseline OR unstable RR OR CBT rising
2. **REM** — Low movement + Irregular RR + Variable HR + Flat CBT
3. **N3** — Near-zero movement + Lowest HR + Very stable RR + Lowest CBT
4. **N2** — Low movement + HR below baseline + Stable RR + Falling CBT
5. **N1** — Default fallback (transition stage)

### Scoring System
| Criterion | Points |
|-----------|--------|
| CBT drop ≥ threshold | +2 |
| HR drop ≥ threshold | +2 |
| RR stable (low variance) | +1 |
| Skin temp rise ≥ threshold | +1 |
| Low movement overall | +2 |
| **Total** | **0–8** |

| Score | Quality |
|-------|---------|
| 6–8 | GOOD ✅ |
| 3–5 | MODERATE ⚠️ |
| 0–2 | POOR ❌ |

---

## 🔧 Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Bad Request — malformed input |
| 401 | Unauthorized — invalid/expired JWT |
| 403 | Forbidden — accessing another user's data |
| 404 | Not Found — resource does not exist |
| 409 | Conflict — duplicate resource (same email/timestamp) |
| 422 | Unprocessable — validation failed |
| 500 | Internal Server Error |

All error responses follow:
```json
{
  "success": false,
  "message": "Descriptive error message",
  "errors": [{ "field": "email", "message": "Valid email required." }]
}
```

---

## 🔒 Security Notes

- Passwords are hashed with **bcryptjs** (cost factor 10)
- JWT tokens expire in 7 days (configurable via `JWT_EXPIRES_IN`)
- OTPs are single-use and time-limited (configurable via `OTP_EXPIRY_MINUTES`)
- All protected routes validate ownership — users cannot access other users' data
- In production: use HTTPS, a strong `JWT_SECRET`, and a real SMS provider (Twilio)

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
