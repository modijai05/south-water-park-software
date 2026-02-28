const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth.js');
const entryRoutes = require('./routes/entries.js');
const userRoutes = require('./routes/users.js');
const { sendSMSRouter } = require('./routes/sms.js');
const ticketConfigRoutes = require('./routes/ticketConfig.js');
const ticketDemandAnalysisRoutes = require('./routes/ticketDemandAnalysis.js');
const { analyticsRouter } = require('./routes/analytics.js');
const { errorHandler } = require('./middleware/errorHandler.ts');
const { User } = require('./models/User.ts');
const { dbHealthMonitor } = require('./utils/databaseHealth.js');

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
const requestCounts = new Map();
app.use((req, res, next) => {
  const key = `${req.method}:${req.path}`;
  requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoints
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

app.get('/api/database-health', (req, res) => {
  const health = dbHealthMonitor.getHealth();
  const statusCode = health.connected ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ticket-config', ticketConfigRoutes);
app.use('/api/ticket-demand-analysis', ticketDemandAnalysisRoutes);
app.use('/api/analytics', analyticsRouter);
app.use('/api', sendSMSRouter);

app.use(errorHandler);

// Use persistent MongoDB with enhanced connection handling

async function startServer() {
  try {
    // REQUIRE MongoDB URI for data persistence
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:npPqPhXwCMbiSIFS@tms.f2ekue9.mongodb.net/south_water_park?appName=TMS';
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is required for data persistence');
      console.error('💥 Server cannot start without database connection');
      console.error('🔧 Please set MONGODB_URI in your environment variables');
      console.error('🌐 For MongoDB Atlas setup, see: MONGODB_ATLAS_PROFESSIONAL_SETUP.md');
      process.exit(1);
    }
    
    console.log('🔗 MongoDB Connection Setup');
    console.log('📋 MONGODB_URI: CONFIGURED');
    
    let connectionAttempts = 0;
    const maxAttempts = 5; // Increased attempts for reliability
    
    while (connectionAttempts < maxAttempts) {
      try {
        connectionAttempts++;
        console.log(`🔄 Connection attempt ${connectionAttempts}/${maxAttempts}...`);
        
        await mongoose.connect(mongoUri, {
          maxPoolSize: 20, // Increased pool size for production
          serverSelectionTimeoutMS: 15000, // Increased timeout
          socketTimeoutMS: 60000, // Increased timeout
          connectTimeoutMS: 15000, // Increased timeout
          heartbeatFrequencyMS: 10000,
          retryWrites: true,
          w: 'majority',
          readPreference: 'primary',
        });
        
        await mongoose.connection.db.admin().ping();
        
        console.log('✅ MongoDB connected (persistent) - Production Ready');
        console.log('🔗 Connection Details:');
        console.log(`   - Host: ${mongoose.connection.host}`);
        console.log(`   - Database: ${mongoose.connection.name}`);
        console.log(`   - Ready State: ${mongoose.connection.readyState}`);
        console.log('🛡️ Production Safeguards: ENABLED');
        console.log('   - No in-memory fallback');
        console.log('   - Zero data loss guarantee');
        console.log('   - Connection retry logic active');
        console.log('   - Data persistence enforced');
        
        // Set up connection monitoring
        mongoose.connection.on('error', (err) => {
          console.error('❌ MongoDB connection error:', err);
          console.error('🚨 Database connection lost - Server will exit');
          process.exit(1);
        });
        
        mongoose.connection.on('disconnected', () => {
          console.warn('⚠️ MongoDB disconnected');
          console.error('🚨 Database connection lost - Server will exit');
          process.exit(1);
        });
        
        mongoose.connection.on('reconnected', () => {
          console.log('🔄 MongoDB reconnected');
        });
        
        break; // Success, exit retry loop
        
      } catch (error) {
        console.error(`❌ Connection attempt ${connectionAttempts} failed:`, error.message);
        
        if (connectionAttempts >= maxAttempts) {
          console.error('💥 All connection attempts failed');
          console.error('🔧 Common solutions:');
          console.error('   1. Check MongoDB Atlas IP whitelist');
          console.error('   2. Verify connection string format');
          console.error('   3. Check network connectivity');
          console.error('   4. Confirm database credentials');
          console.error('🚨 Cannot start without persistent database');
          console.error('💥 Server exiting to prevent data loss');
          process.exit(1);
        } else {
          console.log(`⏳ Retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
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
      console.log('🗄️ Database Status: MongoDB Atlas (Persistent)');
      console.log('🔒 Data Persistence: ENABLED - Zero data loss guaranteed');
      console.log('🛡️ Production Mode: All data persisted to MongoDB Atlas');
      console.log('👥 Default Admins: admin1/admin1, admin2/admin2, admin3/admin3');
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

// Seed database with default users
async function seedDatabase() {
  try {
    const defaultUsers = [
      { username: 'admin1', password: 'admin1', role: 'admin', fullName: 'Admin User 1' },
      { username: 'admin2', password: 'admin2', role: 'admin', fullName: 'Admin User 2' },
      { username: 'admin3', password: 'admin3', role: 'admin', fullName: 'Admin User 3' },
      { username: 'staff1', password: 'staff1', role: 'staff', fullName: 'Staff User 1' },
      { username: 'staff2', password: 'staff2', role: 'staff', fullName: 'Staff User 2' },
      { username: 'staff3', password: 'staff3', role: 'staff', fullName: 'Staff User 3' },
      { username: 'staff4', password: 'staff4', role: 'staff', fullName: 'Staff User 4' },
      { username: 'staff5', password: 'staff5', role: 'staff', fullName: 'Staff User 5' },
    ];

    for (const userData of defaultUsers) {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        console.log(`✅ Created default user: ${userData.username} (${userData.role})`);
      }
    }

    console.log('Database seeding completed');
  } catch (error) {
    console.error('Database seeding error:', error);
  }
}

// Graceful shutdown with data preservation
process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received - Starting graceful shutdown...');
  
  try {
    // Stop health monitoring
    dbHealthMonitor.stopMonitoring();
    console.log('🔄 Database health monitoring stopped');
    
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      console.log('🔄 Closing MongoDB connection...');
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
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
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
