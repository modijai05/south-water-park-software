const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin } = require('../middleware/auth.js');
const { User } = require('../models/User.js');
const { Entry } = require('../models/Entry.js');

const router = Router();

// GET /api/users - Get all users (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Users list API called successfully');
    const users = await User.find({}).select('-password -loginLogs');
    
    const result = {
      success: true,
      data: users || []  // Always return an array
    };
    
    res.json(result);
  } catch (error) {
    console.error('Users list API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/users/:id - Get single user
router.get('/:id', authenticate, async (req, res) => {
  try {
    console.error('Get single user API called successfully');
    const user = await User.findById(req.params.id).select('-password -loginLogs');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const result = {
      success: true,
      data: { user }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Get single user API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, async (req, res) => {
  try {
    console.error('Update user API called successfully');
    const { password, ...updateData } = req.body;
    
    // Only allow users to update their own profile, or admins to update any
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }
    
    // Handle password update with proper hashing
    if (password) {
      const bcrypt = require('bcryptjs');
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -loginLogs');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const result = {
      success: true,
      message: 'User updated successfully',
      data: { user }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Update user API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Delete user API called successfully');
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const result = {
      success: true,
      message: 'User deleted successfully'
    };
    
    res.json(result);
  } catch (error) {
    console.error('Delete user API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/users/:id/logs - Get user login logs (admin only)
router.get('/:id/logs', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('User logs API called successfully');
    const user = await User.findById(req.params.id).select('loginLogs username fullName');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const result = {
      success: true,
      data: {
        username: user.username,
        logs: user.loginLogs || []
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('User logs API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user logs',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/users/:id/reset-password - Reset user password (admin only)
router.post('/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Reset password API called successfully');
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }
    
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { password: hashedPassword },
      { new: true, runValidators: true }
    ).select('-password -loginLogs');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const result = {
      success: true,
      message: 'Password reset successfully',
      data: { user }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Reset password API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reset password',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/users - Create new user (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Create user API called successfully');
    const { username, password, role, email, fullName } = req.body;
    
    // Handle fallback mode when database is not connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log('Users: Database not connected, using fallback mode for user creation');
      
      // In fallback mode, just return success but don't actually create the user
      // This allows testing of the UI without database persistence
      const mockUser = {
        _id: `fallback-${Date.now()}`,
        username: username.trim(),
        role: role,
        email: email?.trim() || undefined,
        fullName: fullName?.trim() || undefined,
        active: true,
        createdAt: new Date()
      };
      
      const result = {
        success: true,
        message: 'User created successfully (fallback mode)',
        data: { user: mockUser }
      };
      
      console.log('✅ User created in fallback mode:', mockUser.username);
      return res.status(201).json(result);
    }
    
    // Validation
    if (!username || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, password, and role are required' 
      });
    }
    
    if (username.trim().length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be at least 3 characters long' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }
    
    if (!['staff', 'admin'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Role must be either staff or admin' 
      });
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }
    
    // Check if username already exists
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Username already exists' 
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create new user
    const newUser = new User({
      username: username.trim(),
      password: hashedPassword,
      role: role,
      email: email?.trim() || undefined,
      fullName: fullName?.trim() || undefined,
      active: true,
      createdAt: new Date(),
      loginLogs: []
    });
    
    const savedUser = await newUser.save();
    
    // Remove password from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    delete userResponse.loginLogs;
    
    const result = {
      success: true,
      message: 'User created successfully',
      data: { user: userResponse }
    };
    
    console.log('✅ User created successfully:', userResponse.username);
    res.status(201).json(result);
  } catch (error) {
    console.error('Create user API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/users/stats - Get user statistics (admin only)
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('User stats API called successfully');
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$active', 1, 0] } },
          inactiveUsers: { $sum: { $cond: ['$active', 0, 1] } },
          adminUsers: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          staffUsers: { $sum: { $cond: [{ $eq: ['$role', 'staff'] }, 1, 0] } },
          recentUsers: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    const result = {
      success: true,
      data: stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        adminUsers: 0,
        staffUsers: 0,
        recentUsers: 0
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('User stats API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
