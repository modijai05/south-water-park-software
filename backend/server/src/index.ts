import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authRoutes from './routes/auth.js';
import entryRoutes from './routes/entries.js';
import userRoutes from './routes/users.js';
import { sendSMSRouter } from './routes/sms.js';
import ticketConfigRoutes from './routes/ticketConfig.js';
import ticketDemandAnalysisRoutes from './routes/ticketDemandAnalysis.js';
import { analyticsRouter } from './routes/analytics.js';
import { errorHandler } from './middleware/errorHandler.js';
import { User } from './models/User.js';
import { dbHealthMonitor } from './utils/databaseHealth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 5000;

// Configure Express for scalability
app.use(cors({ 
  origin: [
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://ticketmanagementthesouth.netlify.app',
    'https://south-water-park-backend.onrender.com'
  ], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Explicit preflight handling
app.options('*', cors());

// Increase payload size for large data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(60000, () => {
    console.log('Request timeout');
    if (!res.headersSent) {
      res.status(408).json({ message: 'Request timeout' });
    }
  });
  next();
});

// Rate limiting for API protection
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5000; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

app.use((req, res, next) => {
  // Exempt auth endpoints from rate limiting
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }
  
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const clientData = requestCounts.get(clientId) || { count: 0, resetTime: now + RATE_WINDOW };
  
  if (now > clientData.resetTime) {
    clientData.count = 0;
    clientData.resetTime = now + RATE_WINDOW;
  }
  
  clientData.count++;
  requestCounts.set(clientId, clientData);
  
  if (clientData.count > RATE_LIMIT) {
    return res.status(429).json({ 
      message: 'Too many requests',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }
  
  next();
});

// Health check endpoint with database status
app.get('/api/health', (req, res) => {
  const dbHealth = dbHealthMonitor.getHealth();
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeConnections: requestCounts.size,
    database: dbHealth,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Database health check endpoint
app.get('/api/database-health', (req, res) => {
  const health = dbHealthMonitor.getHealth();
  const statusCode = health.connected ? 200 : 503;
  res.status(statusCode).json(health);
});

// Seed endpoint
app.post('/api/seed', async (_req, res) => {
  try {
    const ADMINS = [
      { username: 'admin1', password: 'admin1', role: 'admin' as const },
      { username: 'admin2', password: 'admin2', role: 'admin' as const },
      { username: 'admin3', password: 'admin3', role: 'admin' as const },
    ];
    const STAFF = [
      { username: 'staff1', password: 'staff1', role: 'staff' as const },
      { username: 'staff2', password: 'staff2', role: 'staff' as const },
      { username: 'staff3', password: 'staff3', role: 'staff' as const },
      { username: 'staff4', password: 'staff4', role: 'staff' as const },
      { username: 'staff5', password: 'staff5', role: 'staff' as const },
    ];

    for (const u of [...ADMINS, ...STAFF]) {
      const existing = await User.findOne({ username: u.username });
      if (!existing) {
        await User.create(u);
        console.log('Created:', u.username, u.role);
      } else {
        console.log('Exists:', u.username);
      }
    }
    res.json({ message: 'Database seeded successfully!' });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ message: 'Seed failed' });
  }
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/seed') return next();
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'Database not connected. Starting up...' });
    return;
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ticket-config', ticketConfigRoutes);
app.use('/api/ticket-demand-analysis', ticketDemandAnalysisRoutes);
app.use('/api/analytics', analyticsRouter);
app.use('/api', sendSMSRouter);

app.use(errorHandler);

// Use persistent MongoDB with enhanced connection handling
let mongod: MongoMemoryServer | null = null;

async function startServer() {
  try {
    // Try to connect to persistent MongoDB first
    const mongoUri = process.env.MONGODB_URI;
    
    console.log('🔗 MongoDB Connection Setup');
    console.log('📋 MONGODB_URI:', mongoUri ? 'CONFIGURED' : 'NOT CONFIGURED');
    
    if (mongoUri) {
      let connectionAttempts = 0;
      const maxAttempts = 3;
      
      while (connectionAttempts < maxAttempts) {
        try {
          connectionAttempts++;
          console.log(`🔄 Connection attempt ${connectionAttempts}/${maxAttempts}...`);
          console.log('📍 MongoDB URI:', mongoUri.replace(/\/\/([^:]+)@/, '//***:***@')); // Hide credentials in logs
          
          await mongoose.connect(mongoUri, {
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 10000, // Keep trying to send operations for 10 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            connectTimeoutMS: 10000, // How long to try connecting
            heartbeatFrequencyMS: 10000, // Check server status every 10 seconds
            retryWrites: true, // Automatically retry write operations
            w: 'majority', // Write concern for data safety
            readPreference: 'primary', // Read from primary for consistency
          });
          
          // Test the connection with a simple operation
          await mongoose.connection.db.admin().ping();
          
          console.log('✅ MongoDB connected (persistent) - Production Ready');
          console.log('🗄️ Database: MongoDB Atlas');
          console.log('🔒 Connection: Secure with data persistence');
          
          // Set up connection monitoring
          mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
          });
          
          mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
          });
          
          mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
          });
          
          break; // Success, exit retry loop
          
        } catch (error) {
          console.error(`❌ Connection attempt ${connectionAttempts} failed:`, error.message);
          
          if (connectionAttempts >= maxAttempts) {
            console.error('💥 All connection attempts failed');
            console.log('📋 Common solutions:');
            console.log('   1. Whitelist your IP in MongoDB Atlas: https://www.mongodb.com/docs/atlas/security-whitelist/');
            console.log('   2. Check MongoDB Atlas cluster status');
            console.log('   3. Verify connection string format');
            console.log('   4. Ensure network allows outbound connections');
            
            // CRITICAL: Don't fall back to in-memory in production
            if (process.env.NODE_ENV === 'production') {
              console.error('🚨 Production mode: Cannot start without persistent database');
              process.exit(1);
            }
            
            console.log('🔄 Development mode: Falling back to in-memory MongoDB...');
            console.log('⚠️ WARNING: All data will be lost on restart!');
            
            // Fallback to in-memory MongoDB only in development
            mongod = await MongoMemoryServer.create();
            const fallbackUri = mongod.getUri();
            await mongoose.connect(fallbackUri);
            console.log('⚠️ MongoDB connected (in-memory fallback) - Development Only');
          } else {
            console.log(`⏳ Retrying in 3 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }
    } else {
      console.log('⚠️ MONGODB_URI not provided in environment variables');
      console.log('🔄 Using in-memory MongoDB for development only');
      
      // Use in-memory MongoDB if no URI provided
      mongod = await MongoMemoryServer.create();
      const inMemoryUri = mongod.getUri();
      await mongoose.connect(inMemoryUri);
      console.log('⚠️ MongoDB connected (in-memory) - Data will be lost on restart');
    }
    
    // Start database health monitoring
    console.log('🏥 Starting database health monitoring...');
    dbHealthMonitor.startMonitoring(30000); // Check every 30 seconds
    
    // Auto-seed database with default users
    console.log('🌱 Seeding database with default users...');
    await seedDatabase();
    
    // Start the server
    app.listen(PORT, () => {
      console.log('🚀 Server started successfully');
      console.log('📍 Server URL:', `http://localhost:${PORT}`);
      console.log('🗄️ Database Status:', process.env.MONGODB_URI ? 'MongoDB Atlas (Persistent)' : 'In-Memory (Temporary)');
      console.log('� Data Persistence:', process.env.MONGODB_URI ? 'ENABLED - No data loss' : 'DISABLED - Data will be lost');
      console.log('� Default Admins: admin1/admin1, admin2/admin2, admin3/admin3');
      console.log('👥 Default Staff: staff1/staff1, staff2/staff2, staff3/staff3, staff4/staff4, staff5/staff5');
      console.log('🔐 Environment:', process.env.NODE_ENV || 'development');
      console.log('🏥 Health Monitoring: Active (30s intervals)');
      console.log('🔍 Health Check: http://localhost:' + PORT + '/api/health');
    });
  } catch (err) {
    console.error('💥 Failed to start server:', err);
    process.exit(1);
  }
}

async function seedDatabase() {
  const ADMINS = [
    { username: 'admin1', password: 'admin1', role: 'admin' as const },
    { username: 'admin2', password: 'admin2', role: 'admin' as const },
    { username: 'admin3', password: 'admin3', role: 'admin' as const },
  ];
  const STAFF = [
    { username: 'staff1', password: 'staff1', role: 'staff' as const },
    { username: 'staff2', password: 'staff2', role: 'staff' as const },
    { username: 'staff3', password: 'staff3', role: 'staff' as const },
    { username: 'staff4', password: 'staff4', role: 'staff' as const },
    { username: 'staff5', password: 'staff5', role: 'staff' as const },
  ];

  console.log('Seeding database - checking existing users...');
  
  for (const u of [...ADMINS, ...STAFF]) {
    const existing = await User.findOne({ username: u.username });
    if (!existing) {
      await User.create(u);
      console.log('Created new user:', u.username, u.role);
    } else {
      console.log('User already exists, keeping existing data:', u.username, 'Role:', existing.role, 'Active:', existing.active);
    }
  }
  
  console.log('Database seeding completed');
}

// Graceful shutdown with data preservation
process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received - Starting graceful shutdown...');
  
  try {
    // Stop health monitoring
    dbHealthMonitor.stopMonitoring();
    console.log('🔄 Database health monitoring stopped');
    
    // Close all database connections
    if (mongoose.connection.readyState === 1) {
      console.log('🔄 Closing MongoDB connection...');
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
    }
    
    // Stop in-memory server if it was used
    if (mongod) {
      console.log('🔄 Stopping in-memory MongoDB...');
      await mongod.stop();
      console.log('✅ In-memory MongoDB stopped');
    }
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received - Starting graceful shutdown...');
  
  try {
    // Stop health monitoring
    dbHealthMonitor.stopMonitoring();
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    if (mongod) {
      await mongod.stop();
    }
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
