import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';

// Ensure .env is loaded reliably regardless of working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Fix for Node.js SRV lookup issues on Windows / local router DNS (querySrv ECONNREFUSED)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Ignore if custom DNS cannot be set
}

let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;

// Attach Mongoose lifecycle event listeners
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connection established');
});

mongoose.connection.on('error', (err: any) => {
  console.error(`❌ MongoDB connection error: ${err.message || err}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. Scheduling automatic reconnection...');
  scheduleReconnect(5000);
});

const scheduleReconnect = (delayMs: number = 5000) => {
  if (reconnectTimer || isConnecting || mongoose.connection.readyState === 1) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectDatabase().catch(() => {});
  }, delayMs);
};

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1 || isConnecting) {
    return;
  }

  const uri = process.env.MONGODB_URI || '';
  const dbName = process.env.DATABASE_NAME || 'ct_task_manager';

  if (!uri) {
    console.error('❌ MongoDB connection failed: MONGODB_URI is not defined in environment variables');
    scheduleReconnect(10000);
    return;
  }

  try {
    isConnecting = true;
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB connected successfully`);
    console.log(`📦 Database: ${dbName}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ MongoDB connection failed: ${error.message}`);
    } else {
      console.error('❌ MongoDB connection failed: Unknown error');
    }
    // Automatically retry in background rather than killing the server process
    scheduleReconnect(5000);
  } finally {
    isConnecting = false;
  }
};

export const getDatabaseStatus = (): string => {
  const state = mongoose.connection.readyState;
  switch (state) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
};

