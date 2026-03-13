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

// Configure Express for Render deployment with enhanced CORS
app.use(cors({ 
  origin: [
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://ticketmanagementthesouth.netlify.app',
    'https://thesouthticketmanagement.netlify.app',
    'https://south-water-park-backend.onrender.com',
    'https://south-water-park-frontend.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Additional CORS preflight handling for all routes
app.options('*', cors());

// Enhanced security and performance middleware for Render
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for Render deployment
app.set('trust proxy', 1);

// Add CORS headers to all responses as backup
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://ticketmanagementthesouth.netlify.app',
    'https://thesouthticketmanagement.netlify.app',
    'https://south-water-park-backend.onrender.com',
    'https://south-water-park-frontend.onrender.com'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');
  
  next();
});

// Rate limiting middleware
const rateLimit = new Map();
app.use((req, res, next) => {
  const key = req.ip || req.connection.remoteAddress;
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

// Request logging middleware with enhanced tracking for Render
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

// Simple test endpoint for debugging
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('🔐 Database test endpoint called');
    console.log('🔐 Database connection state:', mongoose.connection.readyState);
    
    // Test basic database operation
    const userCount = await User.countDocuments();
    console.log('🔐 User count:', userCount);
    
    // Test user lookup
    const testUser = await User.findOne({ username: 'admin1' });
    console.log('🔐 Test user found:', !!testUser);
    
    res.json({ 
      success: true,
      message: "Database test successful",
      data: {
        connectionState: mongoose.connection.readyState,
        userCount: userCount,
        testUserFound: !!testUser,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('🔐 Database test error:', error);
    console.error('🔐 Database test error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: "Database test failed",
      error: error.message,
      connectionState: mongoose.connection.readyState
    });
  }
});

// Simple auth test endpoint
app.post('/api/test-auth', async (req, res) => {
  try {
    console.log('🔐 Auth test endpoint called');
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    
    console.log('🔐 Database connection state:', mongoose.connection.readyState);
    
    // Test user lookup
    const user = await User.findOne({ username: String(username).trim() });
    console.log('🔐 User found:', !!user);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Test password comparison
    const match = await user.comparePassword(String(password));
    console.log('🔐 Password match result:', match);
    
    if (!match) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Generate test token
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ 
      success: true,
      message: "Auth test successful",
      token: token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        active: user.active
      }
    });
  } catch (error) {
    console.error('🔐 Auth test error:', error);
    console.error('🔐 Auth test error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: "Auth test failed",
      error: error.message,
      connectionState: mongoose.connection.readyState
    });
  }
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

// Start server immediately - Render needs to detect open PORT
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server started successfully');
  console.log('📍 Server URL:', `http://0.0.0.0:${PORT}`);
  console.log('🔐 Environment:', process.env.NODE_ENV || 'development');
  console.log('🔍 Health Check: http://0.0.0.0:' + PORT + '/health');
  console.log('🔍 API Health Check: http://0.0.0.0:' + PORT + '/api/health');
});

// Try to connect to MongoDB in background without blocking server start
setTimeout(async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    console.log('🔄 Attempting MongoDB connection in background...');
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      connectTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`🔧 Host: ${mongoose.connection.host}`);
    console.log(`🔧 Database: ${mongoose.connection.name}`);
    
  } catch (error) {
    console.log('⚠️ MongoDB connection failed, server running in fallback mode');
    console.log('🔧 Authentication will work with hardcoded users');
  }
}, 2000); // Start connection attempt after 2 seconds

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received - Starting graceful shutdown...');
  
  try {
    if (mongoose.connection.readyState === 1) {
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
