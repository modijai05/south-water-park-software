const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.ts');
const { User } = require('../models/User.ts');

const router = Router();

// Mock Entry model for now (will be replaced with actual Entry model)
const Entry = {
  find: async (query) => {
    // Mock implementation
    return [];
  },
  findById: async (id) => {
    // Mock implementation
    return null;
  },
  create: async (data) => {
    // Mock implementation
    return data;
  },
  findByIdAndUpdate: async (id, data) => {
    // Mock implementation
    return data;
  },
  deleteOne: async (query) => {
    // Mock implementation
    return { deletedCount: 1 };
  }
};

// GET /api/entries - Get all entries (admin/staff)
router.get('/', authenticate, async (req, res) => {
  try {
    const entries = await Entry.find({}).populate('createdBy', 'username fullName');
    res.json({ entries });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ message: 'Failed to fetch entries' });
  }
});

// GET /api/entries/:id - Get single entry
router.get('/:id', authenticate, async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id).populate('createdBy', 'username fullName');
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    res.json({ entry });
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ message: 'Failed to fetch entry' });
  }
});

// POST /api/entries - Create new entry
router.post('/', authenticate, async (req, res) => {
  try {
    const entryData = {
      ...req.body,
      createdBy: req.user._id,
      createdAt: new Date()
    };
    
    const entry = await Entry.create(entryData);
    const populatedEntry = await Entry.findById(entry._id).populate('createdBy', 'username fullName');
    
    res.status(201).json({ 
      message: 'Entry created successfully',
      entry: populatedEntry 
    });
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ message: 'Failed to create entry' });
  }
});

// PUT /api/entries/:id - Update entry
router.put('/:id', authenticate, async (req, res) => {
  try {
    const entry = await Entry.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username fullName');
    
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    res.json({ 
      message: 'Entry updated successfully',
      entry 
    });
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ message: 'Failed to update entry' });
  }
});

// DELETE /api/entries/:id - Delete entry (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await Entry.deleteOne({ _id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ message: 'Failed to delete entry' });
  }
});

module.exports = router;
