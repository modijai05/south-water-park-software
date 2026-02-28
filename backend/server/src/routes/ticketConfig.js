const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.js');
const { TicketConfig } = require('../models/TicketConfig.js');

const router = Router();


// GET /api/ticket-config - Get current ticket configuration
router.get('/', authenticate, async (req, res) => {
  try {
    console.error('Ticket config list API called successfully');
    const configs = await TicketConfig.find().sort({ ticketType: 1 });
    
    const result = {
      success: true,
      data: configs || []  // Always return an array
    };
    
    res.json(result);
  } catch (error) {
    console.error('Ticket config list API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch ticket configurations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// PUT /api/ticket-config/:id - Update ticket configuration (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Update ticket config API called successfully');
    const config = await TicketConfig.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!config) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket configuration not found' 
      });
    }
    
    const result = {
      success: true,
      message: 'Ticket configuration updated successfully',
      data: { config }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Update ticket config API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update ticket configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/ticket-config - Create new ticket configuration (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Create ticket config API called successfully');
    const config = await TicketConfig.create(req.body);
    
    const result = {
      success: true,
      message: 'Ticket configuration created successfully',
      data: { config }
    };
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Create ticket config API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create ticket configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
