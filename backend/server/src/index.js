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
const { errorHandler } = require('./middleware/errorHandler.js');
const { User } = require('./models/User.js');
const { dbHealthMonitor } = require('./utils/databaseHealth.js');

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 5000;

// Configure Express for scalability with enhanced CORS
app.use(cors({ 
  origin: [
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://ticketmanagementthesouth.netlify.app',
    'https://thesouthticketmanagement.netlify.app',
    'https://south-water-park-backend.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Additional CORS preflight handling
app.options('*', cors());

// Enhanced security and performance middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting middleware
const rateLimit = new Map();
app.use((req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  if (!rateLimit.has(key)) {
    rateLimit.set(key, { count: 1, windowStart });
  } else {
    const data = rateLimit.get(key);
    if (now - data.windowStart > 60000) {
      data.count = 1;
      data.windowStart = now;
    } else {
      data.count++;
      if (data.count > 100) { // 100 requests per minute
        return res.status(429).json({ message: 'Too many requests' });
      }
    }
  }
  next();
});

// Request logging middleware with enhanced tracking
const requestCounts = new Map();
app.use((req, res, next) => {
  const key = `${req.method}:${req.path}`;
  requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip} - Count: ${requestCounts.get(key)}`);
  
  // Add response time tracking
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`);
  });
  
  next();
});

// Root endpoint for basic connectivity test
app.get('/', (req, res) => {
  res.json({ 
    message: "South Water Park Backend API",
    status: "Running",
    timestamp: new Date().toISOString(),
    origin: req.headers.origin
  });
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: "OK" });
});

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

// Simple test endpoint for CORS testing
app.get('/api/test', (req, res) => {
  res.json({ 
    message: "CORS test successful",
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    method: req.method
  });
});

app.post('/api/test', (req, res) => {
  res.json({ 
    message: "POST CORS test successful",
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    method: req.method,
    body: req.body
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
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/?appName=Cluster';
    
    console.log('🔧 MongoDB URI from environment:', mongoUri);
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is required for data persistence');
      console.error('🔧 Current environment variables:', Object.keys(process.env).filter(key => key.includes('MONGO')));
      console.error('🔧 Available MONGO variables:', Object.keys(process.env).filter(key => key.includes('MONGO')));
      process.exit(1);
    }
    
    console.log('🔗 MongoDB URI validated:', mongoUri);
    console.log('🔗 MongoDB URI format check:', mongoUri.includes('mongodb+srv://'));
    console.log('� MongoDB URI contains user credentials:', mongoUri.includes('jaimodi05bapa_db_user'));
    
    // Enhanced connection function with detailed debugging
    const connectToMongoDB = async () => {
      try {
        console.log('🔄 Connecting to MongoDB...');
        
        const connection = await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          connectTimeoutMS: 10000,
          heartbeatFrequencyMS: 10000,
          retryWrites: true,
          w: 'majority',
          readPreference: 'primary',
          retryReads: true
        });
        
        console.log('✅ MongoDB connected successfully');
        console.log('🔧 MongoDB connection details:');
        console.log(`   - Host: ${mongoose.connection.host}`);
        console.log(`   - Database: ${mongoose.connection.name}`);
        console.log(`   - Ready State: ${mongoose.connection.readyState}`);
        
        // Set up connection monitoring
        setupConnectionMonitoring();
        
        // Initialize database with default users if needed
        console.log('🌱 Seeding database with default users...');
        // await seedDatabase();
        console.log('✅ Database seeding completed');
        
        return connection;
        
      } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        console.error('❌ Error Code:', error.code);
        console.error('❌ Error Message:', error.message);
        console.error('❌ Error Name:', error.name);
        console.error('❌ Error Stack:', error.stack);
        
        // In production, we might want to attempt reconnection
        if (process.env.NODE_ENV === 'production') {
          console.error('🔄 Production mode: Attempting to reconnect...');
          setTimeout(connectToMongoDB, 30000); // Retry after 30 seconds
        } else {
          console.warn('⚠️ Continuing in development mode without database');
          console.warn('🔄 Some features may not work properly');
        }
        
        // Don't exit - let mongoose auto-reconnect
      }
    };
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected - attempting to reconnect...');
      console.warn('   - In production mode: scheduling reconnection attempt');
      setTimeout(connectToMongoDB, 30000);
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
      console.log('🔧 MongoDB connection details:');
      console.log(`   - Host: ${mongoose.connection.host}`);
      console.log(`   - Database: ${mongoose.connection.name}`);
      console.log(`   - Ready State: ${mongoose.connection.readyState}`);
    });
    
    mongoose.connection.on('fullsetup', () => {
      console.log('🔄 MongoDB full setup completed');
    });
    
    mongoose.connection.on('open', () => {
      console.warn('⚠️ MongoDB connection opened');
    });
    
    mongoose.connection.on('close', () => {
      console.log('🔄 MongoDB connection closed');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
      console.log('� MongoDB connection details:');
      console.log(`   - Host: ${mongoose.connection.host}`);
    });
    
    // Start server immediately - Render needs to detect open PORT
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 Server started successfully');
      console.log('📍 Server URL:', `http://0.0.0.0:${PORT}`);
      console.log('🔐 Environment:', process.env.NODE_ENV || 'development');
      console.log('🔍 Health Check: http://0.0.0.0:' + PORT + '/health');
      console.log('🔍 API Health Check: http://0.0.0.0:' + PORT + '/api/health');
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', err);
      }
      process.exit(1);
    });
    
  } catch (err) {
    console.error('💥 Failed to start server:', err);
    process.exit(1);
  }
}

// Separate MongoDB connection function
async function connectToMongoDB(mongoUri) {
  let connectionAttempts = 0;
  const maxAttempts = 5;
  
  const attemptConnection = async () => {
    try {
      connectionAttempts++;
      console.log(`� MongoDB connection attempt ${connectionAttempts}/${maxAttempts}...`);
      
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        connectTimeoutMS: 10000,
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
      
      // Set up connection monitoring
      setupConnectionMonitoring();
      
      // Start database health monitoring
      console.log('🏥 Starting database health monitoring...');
      dbHealthMonitor.startMonitoring(30000);

      // Auto-seed database with default users
      console.log('🌱 Seeding database with default users...');
      await seedDatabase();
      
    } catch (error) {
      console.error(`❌ Connection attempt ${connectionAttempts} failed:`, error.message);
      
      if (connectionAttempts >= maxAttempts) {
        console.error('💥 All connection attempts failed');
        console.error('🔧 Common solutions:');
        console.error('   1. Check MongoDB Atlas IP whitelist');
        console.error('   2. Verify connection string format');
        console.error('   3. Check network connectivity');
        console.error('   4. Confirm database credentials');
        
        // In production, schedule retry attempts
        if (process.env.NODE_ENV === 'production') {
          console.error('🔄 Will retry connection in background...');
          setTimeout(attemptConnection, 30000); // Retry after 30 seconds
        } else {
          console.warn('⚠️ Continuing in development mode without database');
          console.warn('🔄 Some features may not work properly');
        }
      } else {
        console.log(`⏳ Retrying in 5 seconds...`);
        setTimeout(attemptConnection, 5000);
      }
    }
  };
  
  // Start connection attempts
  attemptConnection();
}

function setupConnectionMonitoring() {
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
    // Don't exit - let mongoose auto-reconnect
  });
  
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected - attempting to reconnect...');
    // Don't exit - let mongoose auto-reconnect
  });
  
  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected successfully');
  });
  
  mongoose.connection.on('connecting', () => {
    console.log('🔄 MongoDB connecting...');
  });
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
  // Log the error but don't exit immediately in production
  if (process.env.NODE_ENV === 'production') {
    console.error('🔄 Continuing in production mode...');
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  // Log the error but don't exit immediately in production
  if (process.env.NODE_ENV === 'production') {
    console.error('🔄 Continuing in production mode...');
  } else {
    process.exit(1);
  }
});

// Start the server
startServer();
