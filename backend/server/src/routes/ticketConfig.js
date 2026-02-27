const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.ts');

const router = Router();

// Mock TicketConfig model
const TicketConfig = {
  findOne: async () => {
    // Mock implementation
    return {
      _id: 'default',
      name: 'Default Ticket Config',
      price: 100,
      maxEntries: 1000,
      active: true
    };
  },
  findByIdAndUpdate: async (id, data) => {
    // Mock implementation
    return { _id: id, ...data };
  },
  create: async (data) => {
    // Mock implementation
    return { _id: `config_${Date.now()}`, ...data };
  },
  find: async () => {
    // Mock implementation
    return [
      {
        _id: 'default',
        name: 'Default Ticket Config',
        price: 100,
        maxEntries: 1000,
        active: true
      }
    ];
  }
};

// GET /api/ticket-config - Get current ticket configuration
router.get('/', authenticate, async (req, res) => {
  try {
    const config = await TicketConfig.findOne();
    res.json({ config });
  } catch (error) {
    console.error('Get ticket config error:', error);
    res.status(500).json({ message: 'Failed to fetch ticket configuration' });
  }
});

// PUT /api/ticket-config/:id - Update ticket configuration (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const config = await TicketConfig.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!config) {
      return res.status(404).json({ message: 'Ticket configuration not found' });
    }
    
    res.json({ 
      message: 'Ticket configuration updated successfully',
      config 
    });
  } catch (error) {
    console.error('Update ticket config error:', error);
    res.status(500).json({ message: 'Failed to update ticket configuration' });
  }
});

// POST /api/ticket-config - Create new ticket configuration (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const config = await TicketConfig.create(req.body);
    res.status(201).json({ 
      message: 'Ticket configuration created successfully',
      config 
    });
  } catch (error) {
    console.error('Create ticket config error:', error);
    res.status(500).json({ message: 'Failed to create ticket configuration' });
  }
});

module.exports = router;
