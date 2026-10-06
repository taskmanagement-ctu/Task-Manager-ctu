import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase, getDatabaseStatus } from './config/database';
import routes from './routes';

// Load environment variables reliably regardless of working directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Middleware to inform clients if database is still connecting
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }
  const dbStatus = getDatabaseStatus();
  if (dbStatus !== 'connected' && req.path.startsWith('/api/')) {
    return res.status(503).json({
      success: false,
      message: 'Database is still connecting. Please wait a few moments and try again.',
      database: dbStatus,
    });
  }
  next();
});

// Routes
app.use('/api', routes);

// Global Error Handler to catch any route errors without crashing
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled route error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Prevent Node from crashing on unhandled promise rejections or exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception in Node process:', error);
});

// Start listening immediately so Nginx reverse proxy never hits 502 Bad Gateway
const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);

  // Connect to MongoDB asynchronously in the background
  connectDatabase().catch((error) => {
    console.error('Initial DB connection attempt encountered error:', error);
  });
});

export default server;

