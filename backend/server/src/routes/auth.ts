import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      res.status(400).json({ message: 'Username and password required' });
      return;
    }
    const user = await User.findOne({ username: String(username).trim() });
    if (!user) {
      await logLogin(username, false).catch(() => {});
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    if (!user.active) {
      res.status(401).json({ message: 'Account is inactive' });
      return;
    }
    const match = await user.comparePassword(String(password));
    if (!match) {
      await logLogin(username, false).catch(() => {});
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    await logLogin(username, true).catch(() => {});
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user._id.toString(), username: user.username, fullName: user.fullName, role: user.role },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    console.error('Login error:', err);
    res.status(500).json({ message });
  }
});

async function logLogin(username: string, success: boolean) {
  const user = await User.findOne({ username: String(username).trim() });
  if (user) {
    if (!Array.isArray(user.loginLogs)) user.loginLogs = [];
    user.loginLogs.push({ timestamp: new Date(), success });
    await user.save();
  }
}

/** GET /api/auth/me */
router.get('/me', authenticate, (req: AuthRequest, res) => {
  res.json({
    user: req.user
      ? { id: req.user._id, username: req.user.username, fullName: req.user.fullName, role: req.user.role }
      : null,
  });
});

export default router;
