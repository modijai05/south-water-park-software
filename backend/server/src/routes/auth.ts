import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

/** POST /api/auth/login */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body ?? {};
    console.log('Login attempt:', { username, passwordProvided: !!password });
    
    if (!username || !password) {
      console.log('Login: Missing username or password');
      res.status(400).json({ message: 'Username and password required' });
      return;
    }
    
    const user = await User.findOne({ username: String(username).trim() }).select('+password');
    console.log('Login: User found:', !!user, 'Username:', username);
    
    if (!user) {
      await logLogin(username, false).catch(() => {});
      console.log('Login: User not found');
      res.status(401).json({ message: 'Invalid username or password' });
      return;
    }
    
    if (!user.active) {
      console.log('Login: User is inactive:', user.username);
      res.status(401).json({ message: 'Account is inactive' });
      return;
    }
    
    const match = await user.comparePassword(String(password));
    console.log('Login: Password match:', match);
    
    if (!match) {
      await logLogin(username, false).catch(() => {});
      console.log('Login: Password mismatch');
      res.status(401).json({ message: 'Invalid username or password' });
      return;
    }
    
    await logLogin(username, true).catch(() => {});
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    console.log('Login: Success, token generated for user:', user.username, 'Role:', user.role);
    
    res.json({
      token,
      user: { id: user._id.toString(), username: user.username, fullName: user.fullName, role: user.role },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed. Please try again.' });
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
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  res.json({
    user: req.user
      ? { id: req.user._id, username: req.user.username, fullName: req.user.fullName, role: req.user.role }
      : null,
  });
});

export default router;
