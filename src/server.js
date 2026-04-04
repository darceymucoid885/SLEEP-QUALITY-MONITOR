/**
 * @file server.js
 * @description Main Express application entry point.
 * Loads environment variables, connects to MongoDB, wires up all routes,
 * applies global middleware, and starts the HTTP server.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const http = require('http');
const { Server } = require('socket.io');

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const dataRoutes     = require('./routes/dataRoutes');
const analysisRoutes = require('./routes/analysisRoutes');

// ─── Initialize Express & HTTP Server ─────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Initialize Socket.io ─────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Expose io to request object (optional but good practice to allow controllers)
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🔌 Client connected via WebSocket: ${socket.id}`);
  
  socket.on('join_user_room', (userId) => {
    socket.join(userId);
    console.log(`👤 Socket ${socket.id} joined room for User: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ─── Connect to Database ──────────────────────────────────────────────────────
connectDB();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors());  // Allow cross-origin requests from frontend clients
app.use(express.json({ limit: '10mb' }));  // Parse incoming JSON bodies
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Sleep Monitoring Dashboard API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);          // Authentication: /auth/register, /auth/login
app.use('/', dataRoutes);              // Sensor ingestion: /sensor-data
app.use('/', analysisRoutes);          // Reports: /sleep-report/:id, /sleep-stages/:id, /hydration-status/:id

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`❌ [${statusCode}] ${err.message}`);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Sleep Monitoring API running at http://localhost:${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV}`);
});

module.exports = server;
