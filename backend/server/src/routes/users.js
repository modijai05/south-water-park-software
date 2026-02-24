const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.js');
const { User } = require('../models/User.js');

const router = Router();

// GET /api/users - Get all users (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password -loginLogs');
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - Get single user
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -loginLogs');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    
    // Only allow users to update their own profile, or admins to update any
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -loginLogs');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      message: 'User updated successfully',
      user 
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;
