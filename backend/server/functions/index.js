const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Import your existing server routes and middleware
const { authMiddleware } = require('./src/middleware/auth');
const authRoutes = require('./src/routes/auth');
const entryRoutes = require('./src/routes/entries');
const ticketConfigRoutes = require('./src/routes/ticketConfig');
const statsRoutes = require('./src/routes/stats');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// MongoDB connection
const MONGODB_URI = functions.config().mongodb.uri || process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/ticket-config', ticketConfigRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Export as Firebase Function
exports.api = functions.https.onRequest(app);
