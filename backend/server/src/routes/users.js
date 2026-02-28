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

module.exports = router;
