/**
 * @file db.js
 * @description MongoDB connection configuration using Mongoose.
 * Connects to the database specified in the MONGODB_URI environment variable.
 * Fallback to in-memory MongoDB for local development if local connection fails.
 */

const mongoose = require('mongoose');

let mongod = null;

/**
 * Establishes a connection to MongoDB.
 * Uses connection pooling and fallback to memory server for zero-config dev setup.
 */
const connectDB = async () => {
  const isDev = process.env.NODE_ENV === 'development';
  let dbUrl = process.env.MONGODB_URI;

  // Function to start memory server and return URI
  const startMemoryServer = async () => {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    console.log('ℹ️  Starting In-Memory MongoDB for development...');
    mongod = await MongoMemoryServer.create();
    return mongod.getUri();
  };

  try {
    // 1. Determine connection URL
    if (!dbUrl && isDev) {
      dbUrl = await startMemoryServer();
    }

    // 2. Perform connection (single attempt)
    const conn = await mongoose.connect(dbUrl, {
      serverSelectionTimeoutMS: 3000, // Short timeout for faster fallback
      maxPoolSize: 10,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // 3. Fallback logic if the primary connection failed
    if (isDev && !mongod) {
      console.warn(`⚠️  Primary MongoDB Connection Failed: ${error.message}`);
      console.log('🔄 Attempting automatic fallback to In-Memory MongoDB...');
      
      try {
        // Disconnect any partial connection states before retrying
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
        
        const fallbackUrl = await startMemoryServer();
        const conn = await mongoose.connect(fallbackUrl);
        console.log(`✅ MongoDB Connected (In-Memory Fallback): ${conn.connection.host}`);
        return;
      } catch (fallbackError) {
        console.error(`❌ Fallback DB failed: ${fallbackError.message}`);
      }
    }

    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Handle cleanup on process termination (closing memory server)
const cleanup = async () => {
  if (mongod) await mongod.stop();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Basic connection monitoring
mongoose.connection.on('disconnected', () => {
  // Only warn if we're not shutting down
  if (mongoose.connection.readyState !== 0) {
     console.warn('⚠️  MongoDB disconnected. Standard reconnect logic will trigger...');
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully.');
});

module.exports = connectDB;
