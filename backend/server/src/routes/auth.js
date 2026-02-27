const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User.ts');
const { authenticate } = require('../middleware/auth.ts');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    console.log('Login attempt:', { username, passwordProvided: !!password });
    
    if (!username || !password) {
      console.log('Login: Missing username or password');
      res.status(400).json({ message: 'Username and password required' });
      return;
    }
    
    const user = await User.findOne({ username: String(username).trim() });
    if (!user) {
      await logLogin(username, false).catch(() => {});
      console.log('Login: User not found');
      res.status(401).json({ message: 'Invalid username or password' });
      return;
    }
    
    if (!user.active) {
      await logLogin(username, false).catch(() => {});
      console.log('Login: User is inactive');
      res.status(401).json({ message: 'Account is inactive' });
      return;
    }
    
    const match = await user.comparePassword(String(password));
    if (!match) {
      await logLogin(username, false).catch(() => {});
      console.log('Login: Password mismatch');
      res.status(401).json({ message: 'Invalid username or password' });
      return;
    }
    
    await logLogin(username, true).catch(() => {});
    console.log('Login: Success for user:', username);
    
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        active: user.active
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed. Please try again.' });
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
