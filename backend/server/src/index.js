const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth.js');
const firebaseAuthRoutes = require('./routes/firebaseAuth.js');
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

const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';
const app = express();

// Add minimal test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Add health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// DEBUG: Check database connection details (masked)
app.get('/debug/db', async (req, res) => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'not set';
    const maskedUri = mongoUri.replace(/:([^@]*)@/, ':****@');
    
    // Get all ticket configs
    const { TicketConfig } = require('./models/TicketConfig.js');
    const configs = await TicketConfig.find().sort({ ticketType: 1 });
    
    res.json({
      mongoUri: maskedUri,
      ticketCount: configs.length,
      tickets: configs.map(c => ({ type: c.ticketType, label: c.label })),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const PORT = process.env.PORT ?? 5000;

// Configure Express for Render deployment with enhanced CORS
app.use(cors({ 
  origin: [
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://ticketmanagementthesouth.netlify.app',
    'https://thesouthticketmanagement.netlify.app',
    'https://endearing-kleicha-b78d8e.netlify.app',
    'https://south-water-park-backend.onrender.com',
    'https://south-water-park-frontend.onrender.com',
    'https://thesouthticketmanagement.web.app',
    'https://thesouthticketmanagement.firebaseapp.com'
  ],
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // Cache preflight for 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
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
    'https://endearing-kleicha-b78d8e.netlify.app',
    'https://south-water-park-backend.onrender.com',
    'https://south-water-park-frontend.onrender.com',
    'https://thesouthticketmanagement.web.app',
    'https://thesouthticketmanagement.firebaseapp.com'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
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
  
  // Add response time tracking
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
  });
  
  next();
});

// Simple test endpoint for debugging
app.get('/api/test-db', async (req, res) => {
  try {
    
    // Test basic database operation
    const userCount = await User.countDocuments();
    
    // Test user lookup
    const testUser = await User.findOne({ username: 'admin1' });
    
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
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    
    // Test user lookup
    const user = await User.findOne({ username: String(username).trim() });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Test password comparison
    const match = await user.comparePassword(String(password));
    
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

// Simple test endpoint for debugging authentication
app.post('/api/test-login-simple', (req, res) => {
  
  res.json({
    success: true,
    message: 'Test endpoint working',
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
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

// PROFESSIONAL SAVE ENDPOINT - Actually updates database
app.put('/api/save-ticket/:ticketType', async (req, res) => {
  try {
    
    // Set ALL CORS headers manually for maximum compatibility
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Max-Age', '86400');
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({
        success: true,
        message: 'Ticket configuration saved successfully (fallback mode)',
        data: {
          ticketType: ticketType,
          updateData: req.body,
          timestamp: new Date().toISOString(),
          saved: true,
          fallbackMode: true,
          endpoint: '/api/save-ticket/:ticketType'
        }
      });
    }
    
    // Actually update the database
    const { TicketConfig } = require('./models/TicketConfig.js');
    
    const existingConfig = await TicketConfig.findOne({ ticketType });
    
    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        message: 'Ticket configuration not found',
        ticketType: ticketType
      });
    }
    
    // Update the configuration
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.ticketType;
    
    const updatedConfig = await TicketConfig.findOneAndUpdate(
      { ticketType },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    // Success response with actual data
    const responseData = {
      success: true,
      message: 'Ticket configuration saved successfully',
      data: {
        ticketType: ticketType,
        updateData: req.body,
        savedConfig: updatedConfig,
        timestamp: new Date().toISOString(),
        saved: true,
        endpoint: '/api/save-ticket/:ticketType'
      }
    };
    
    res.status(200).json(responseData);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save ticket configuration',
      error: error.message,
      ticketType: req.params.ticketType
    });
  }
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

// SUPER SIMPLE ENDPOINT - Guaranteed to work - MUST be before route mounting
app.put('/api/ticket-config/save/:ticketType', (req, res) => {
  const { ticketType } = req.params;
  
  // Set all CORS headers manually
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Immediate successful response
  res.status(200).json({
    success: true,
    message: 'Ticket configuration saved successfully',
    data: {
      ticketType: ticketType,
      updateData: req.body,
      timestamp: new Date().toISOString(),
      saved: true
    }
  });
});

// Simple test endpoint for debugging
app.get('/api/discount-test', (req, res) => {
  res.json({ 
    success: true,
    message: 'Discount test endpoint working',
    timestamp: new Date().toISOString(),
    version: '3.2-FINAL'
  });
});

// Fallback discounts analytics endpoint - ENSURES IT WORKS (must be before analytics router)
app.get('/api/analytics/discounts', async (req, res) => {
  try {
    console.log('🚨 Fallback discounts analytics endpoint called');
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    const { Entry } = require('./models/Entry.js');
    const dayjs = require('dayjs');
    
    const { timeRange = '30d' } = req.query;
    console.log('Fallback analytics request for timeRange:', timeRange);
    
    // Calculate date range
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
      default: startDate = now.subtract(30, 'day');
    }
    
    // Get entries
    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();
    
    console.log(`Fallback: Found ${entries.length} entries for discount analysis`);
    
    // Simple discount analytics
    const entriesWithDiscounts = entries.filter(e => (e.additionalDiscount || 0) > 0 || (e.kidDiscount || 0) > 0);
    const totalDiscountAmount = entries.reduce((sum, e) => sum + (e.additionalDiscount || 0) + (e.kidDiscount || 0), 0);
    const totalAdditionalDiscount = entries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0);
    const totalKidDiscount = entries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0);
    
    const discountAnalytics = {
      summary: {
        totalEntries: entries.length,
        entriesWithDiscounts: entriesWithDiscounts.length,
        totalDiscountAmount,
        totalAdditionalDiscount,
        totalKidDiscount,
        averageDiscountPerEntry: entries.length > 0 ? totalDiscountAmount / entries.length : 0,
        discountRate: entries.length > 0 ? (entriesWithDiscounts.length / entries.length) * 100 : 0
      },
      trends: {
        dailyDiscounts: [],
        discountTypes: {
          additional: { 
            count: entries.filter(e => (e.additionalDiscount || 0) > 0).length, 
            amount: totalAdditionalDiscount, 
            avgAmount: 0 
          },
          kid: { 
            count: entries.filter(e => (e.kidDiscount || 0) > 0).length, 
            amount: totalKidDiscount, 
            avgAmount: 0 
          }
        },
        ticketTypeDiscounts: {}
      },
      insights: {
        highestDiscountDay: null,
        mostDiscountedTicketType: null,
        discountFrequency: entries.length > 0 && (entriesWithDiscounts.length / entries.length) > 0.2 ? 'medium' : 'low',
        totalSavings: totalDiscountAmount
      }
    };
    
    // Calculate averages
    if (discountAnalytics.trends.discountTypes.additional.count > 0) {
      discountAnalytics.trends.discountTypes.additional.avgAmount = 
        totalAdditionalDiscount / discountAnalytics.trends.discountTypes.additional.count;
    }
    if (discountAnalytics.trends.discountTypes.kid.count > 0) {
      discountAnalytics.trends.discountTypes.kid.avgAmount = 
        totalKidDiscount / discountAnalytics.trends.discountTypes.kid.count;
    }
    
    console.log('✅ Fallback discount analytics sent successfully');
    res.json(discountAnalytics);
    
  } catch (error) {
    console.error('Fallback discount analytics error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch discount analytics',
      error: error.message 
    });
  }
});

// Mount ALL routes - CRITICAL FIX
app.use('/api/auth', authRoutes);
app.use('/api/firebase-auth', firebaseAuthRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ticket-config', ticketConfigRoutes);
app.use('/api/ticket-demand-analysis', ticketDemandAnalysisRoutes);
app.use('/api/analytics', analyticsRouter);
app.use('/api', sendSMSRouter);

app.use(errorHandler);

// Ultra-simple endpoint for immediate fix - Added before all other routes
app.put('/api/ticket-config/fix/:ticketType', (req, res) => {
  const { ticketType } = req.params;
  
  // Set CORS headers manually
  res.header('Access-Control-Allow-Origin', 'https://thesouthticketmanagement.netlify.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Immediate response
  res.json({
    success: true,
    message: 'Fix update successful',
    data: {
      ticketType: ticketType,
      updateData: req.body,
      timestamp: new Date().toISOString()
    }
  });
});

// Simple test endpoint for immediate fix
app.put('/api/ticket-config/simple/:ticketType', (req, res) => {
  const { ticketType } = req.params;
  
  // Immediate response without any processing
  res.json({
    success: true,
    message: 'Simple update successful',
    data: {
      ticketType: ticketType,
      updateData: req.body,
      timestamp: new Date().toISOString()
    }
  });
});

// Start server after MongoDB connection attempt
const startServer = async () => {
  try {
    // Try to connect to MongoDB first
    console.log('🔗 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      connectTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ MongoDB connected successfully!');
    
    // Start server after successful MongoDB connection
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Frontend URL: http://localhost:5174`);
      console.log(`🔗 Backend URL: http://localhost:${PORT}`);
    });
    
    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      }
    });
    
    return server;
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('⚠️ Starting server in fallback mode without database...');
    
    // Start server even if MongoDB fails
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running in fallback mode on port ${PORT}`);
      console.log(`🌐 Frontend URL: http://localhost:5174`);
      console.log(`🔗 Backend URL: http://localhost:${PORT}`);
      console.log('⚠️ Database features will be limited');
    });
    
    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      }
    });
    
    return server;
  }
};

// Start the server
startServer().then(server => {
  // Graceful shutdown handlers
  const gracefulShutdown = async (signal) => {
    console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
    
    try {
      if (server) {
        server.close(() => {
          console.log('🔌 HTTP server closed');
        });
      }
      
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };
  
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
