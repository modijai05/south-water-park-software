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

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 5000;

// Configure Express for scalability
app.use(cors({ 
  origin: process.env.CLIENT_URL ?? ['http://localhost:5174', 'https://ticketmanagementthesouth.netlify.app'], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeConnections: requestCounts.size
  });
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

// Use persistent MongoDB with fallback to in-memory
let mongod: MongoMemoryServer | null = null;

async function startServer() {
  try {
    // Try to connect to persistent MongoDB first
    const mongoUri = process.env.MONGODB_URI;
    
    if (mongoUri) {
      try {
        await mongoose.connect(mongoUri);
        console.log('MongoDB connected (persistent)');
      } catch (error) {
        console.log('Failed to connect to persistent MongoDB, falling back to in-memory...');
        // Fallback to in-memory MongoDB
        mongod = await MongoMemoryServer.create();
        const fallbackUri = mongod.getUri();
        await mongoose.connect(fallbackUri);
        console.log('MongoDB connected (in-memory fallback)');
      }
    } else {
      // Use in-memory MongoDB if no URI provided
      mongod = await MongoMemoryServer.create();
      const inMemoryUri = mongod.getUri();
      await mongoose.connect(inMemoryUri);
      console.log('MongoDB connected (in-memory)');
    }
    
    // Auto-seed the database with default users
    await seedDatabase();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(process.env.MONGODB_URI ? 'MongoDB connected (persistent)' : 'MongoDB connected (in-memory)');
      console.log('Database seeded with default users');
      console.log('Default admin credentials: admin1/admin1, admin2/admin2, admin3/admin3');
      console.log('Default staff credentials: staff1/staff1, staff2/staff2, staff3/staff3, staff4/staff4, staff5/staff5');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
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

  for (const u of [...ADMINS, ...STAFF]) {
    const existing = await User.findOne({ username: u.username });
    if (!existing) {
      await User.create(u);
      console.log('Created:', u.username, u.role);
    } else {
      console.log('Exists:', u.username);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (mongod) {
    await mongod.stop();
  }
  await mongoose.disconnect();
  process.exit(0);
});

startServer();
