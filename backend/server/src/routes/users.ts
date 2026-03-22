import { Router } from 'express';
import { User } from '../models/User.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

/** GET /api/users/stats - User statistics (admin only) - FIXED route order */
router.get('/stats', authenticate, requireAdmin, async (_req: any, res: any) => {
  try {
    const [totalUsers, activeUsers, adminUsers, staffUsers, recentUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ active: true }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'staff' }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
    ]);
    
    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      adminUsers,
      staffUsers,
      recentUsers
    });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

/** GET /api/users - List users (admin only) - MOVED AFTER stats */
router.get('/', authenticate, requireAdmin, async (_req: any, res: any) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

/** POST /api/users - Create user (admin only) */
router.post('/', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const { username, password, role, email, fullName } = req.body;
    if (!username || !password || !role) {
      res.status(400).json({ message: 'Username, password and role required' });
      return;
    }
    if (!['admin', 'staff'].includes(role)) {
      res.status(400).json({ message: 'Role must be admin or staff' });
      return;
    }
    
    // Validate password strength
    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters long' });
      return;
    }
    
    const existing = await User.findOne({ username: String(username).trim() });
    if (existing) {
      res.status(400).json({ message: 'Username already exists' });
      return;
    }
    
    const user = new User({ 
      username: String(username).trim(), 
      password, 
      role,
      email: email?.trim() || undefined,
      fullName: fullName?.trim() || undefined
    });
    await user.save();
    res.status(201).json({ 
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id, 
        username: user.username, 
        role: user.role, 
        active: user.active,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

/** PATCH /api/users/:id - Update user (admin only) */
router.patch('/:id', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const { active, password, username, role, email, fullName } = req.body;
    const update: Record<string, unknown> = {};
    
    if (typeof active === 'boolean') update.active = active;
    if (typeof username === 'string' && username.trim().length) {
      update.username = String(username).trim();
      // Check for username uniqueness
      const exists = await User.findOne({ username: update.username, _id: { $ne: req.params.id } });
      if (exists) {
        res.status(400).json({ message: 'Username already exists' });
        return;
      }
    }
    if (typeof role === 'string') {
      if (!['admin', 'staff'].includes(role)) {
        res.status(400).json({ message: 'Role must be admin or staff' });
        return;
      }
      update.role = role;
    }
    if (typeof email === 'string') {
      const emailTrimmed = email.trim();
      if (emailTrimmed) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrimmed)) {
          res.status(400).json({ message: 'Invalid email format' });
          return;
        }
        // Check for email uniqueness
        const emailExists = await User.findOne({ email: emailTrimmed, _id: { $ne: req.params.id } });
        if (emailExists) {
          res.status(400).json({ message: 'Email already exists' });
          return;
        }
        update.email = emailTrimmed;
      } else {
        update.email = undefined; // Allow clearing email
      }
    }
    if (typeof fullName === 'string') {
      update.fullName = fullName.trim() || undefined;
    }
    if (typeof password === 'string' && password.length) {
      if (password.length < 6) {
        res.status(400).json({ message: 'Password must be at least 6 characters long' });
        return;
      }
      // Hash the password before updating
      update.password = await bcrypt.hash(password, 12);
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    // Emit user update event for real-time updates
    req.app?.emit('user-updated', { 
      userId: user._id, 
      username: user.username,
      passwordChanged: !!update.password,
      roleChanged: !!update.role
    });
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

/** DELETE /api/users/:id - Admin only */
router.delete('/:id', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

/** GET /api/users/:id/logs - Login logs (admin only) */
router.get('/:id/logs', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.params.id).select('loginLogs username').lean();
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const logs = (user.loginLogs ?? []).slice(-100).reverse();
    res.json({ username: user.username, logs });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

/** POST /api/users/bulk - Bulk operations (admin only) */
router.post('/bulk', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const { operation, userIds, data } = req.body;
    
    if (!operation || !Array.isArray(userIds)) {
      res.status(400).json({ message: 'Operation and userIds array required' });
      return;
    }
    
    let result;
    switch (operation) {
      case 'activate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { active: true }
        );
        break;
      case 'deactivate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { active: false }
        );
        break;
      case 'delete':
        result = await User.deleteMany({ _id: { $in: userIds } });
        break;
      case 'changeRole':
        if (!data?.role || !['admin', 'staff'].includes(data.role)) {
          res.status(400).json({ message: 'Valid role required for role change' });
          return;
        }
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { role: data.role }
        );
        break;
      default:
        res.status(400).json({ message: 'Invalid operation. Use: activate, deactivate, delete, changeRole' });
        return;
    }
    
    res.json({ 
      message: `Bulk ${operation} completed`,
      modifiedCount: 'modifiedCount' in result ? result.modifiedCount : 'deletedCount' in result ? result.deletedCount : 0,
      acknowledged: result.acknowledged
    });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

/** POST /api/users/:id/reset-password - Reset user password (admin only) */
router.post('/:id/reset-password', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters long' });
      return;
    }
    
    // Hash the new password before updating
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { password: hashedPassword }, 
      { new: true }
    ).select('-password');
    
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    // Emit password change event
    req.app?.emit('user-updated', { 
      userId: user._id, 
      username: user.username,
      passwordChanged: true
    });
    
    res.json({ 
      success: true,
      message: 'Password reset successfully',
      data: {
        id: user._id,
        username: user.username,
        role: user.role,
        active: user.active
      }
    });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

export default router;
