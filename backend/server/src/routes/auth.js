const { Router } = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User.js');
const { authenticate } = require('../middleware/auth.js');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

// OPTIONS handler for CORS preflight
router.options('/login', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.status(204).end();
});

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    console.log('🔐 Login attempt started');
    console.log('🔐 Request body:', JSON.stringify(req.body));
    console.log('🔐 Request headers:', JSON.stringify(req.headers));
    const { username, password } = req.body ?? {};
    console.log('🔐 Login attempt:', { username, passwordProvided: !!password });
    console.log('🔐 Database connection state:', mongoose.connection.readyState);
    
    if (!username || !password) {
      console.log('❌ Login: Missing username or password');
      return res.status(400).json({ message: 'Username and password required' });
    }
    
    // Check database authentication first
    try {
      if (mongoose.connection.readyState === 1) {
        const user = await User.findOne({ username });
        console.log('🔐 Database user found:', user ? 'YES' : 'NO');
        
        if (user && user.password === password) {
          console.log('🔐 Database authentication successful');
          const token = jwt.sign(
            { userId: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
          );
          
          const response = {
            message: 'Login successful',
            token,
            user: {
              id: user._id,
              username: user.username,
              fullName: user.fullName,
              role: user.role,
              active: user.active
            }
          };
          
          console.log('🔐 Database login successful');
          // Set CORS headers
          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Credentials', 'true');
          return res.json(response);
        }
      }
    } catch (dbError) {
      console.error('🔐 Database authentication error:', dbError.message);
    }
    
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Login: Database not connected');
      return res.status(401).json({ message: 'Database not connected - please try again' });
    }
    
    console.log('🔐 Searching for user:', username);
    const user = await User.findOne({ username: String(username).trim() });
    console.log('🔐 User found:', !!user);
    
    if (!user) {
      await logLogin(username, false).catch(() => {});
      console.log('❌ Login: User not found');
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    console.log('🔐 User active status:', user.active);
    if (!user.active) {
      await logLogin(username, false).catch(() => {});
      console.log('❌ Login: User is inactive');
      return res.status(401).json({ message: 'Account is inactive' });
    }
    
    console.log('🔐 Comparing password...');
    const match = await user.comparePassword(String(password));
    console.log('🔐 Password match result:', match);
    
    if (!match) {
      await logLogin(username, false).catch(() => {});
      console.log('❌ Login: Password mismatch');
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    await logLogin(username, true).catch(() => {});
    console.log('✅ Login: Success for user:', username);
    
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('🔐 Token generated successfully');
    
    const response = {
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName || user.username, // Fallback to username if fullName not set
        role: user.role,
        active: user.active
      }
    };
    
    console.log('🔐 Sending login response');
    return res.json(response);
    
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    console.error('❌ Login error:', err);
    console.error('❌ Login error stack:', err.stack);
    console.error('❌ Login error name:', err.name);
    console.error('❌ Database connection state:', mongoose.connection.readyState);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

/** GET /api/auth/me */
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: req.user
      ? { id: req.user._id, username: req.user.username, fullName: req.user.fullName, role: req.user.role }
      : null,
  });
});

async function logLogin(username, success) {
  const user = await User.findOne({ username: String(username).trim() });
  if (user) {
    if (!Array.isArray(user.loginLogs)) user.loginLogs = [];
    user.loginLogs.push({ timestamp: new Date(), success });
    await user.save();
  }
}

module.exports = router;
