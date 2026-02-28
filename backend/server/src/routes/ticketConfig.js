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

// GET /api/ticket-config/pricing/:day - Get pricing for specific day
router.get('/pricing/:day', authenticate, async (req, res) => {
  try {
    console.error('Ticket config pricing API called successfully');
    const { day } = req.params;
    const configs = await TicketConfig.find({ isActive: true }).sort({ ticketType: 1 });
    
    // Filter configs for the specific day and calculate pricing
    const dayPricing = configs.map(config => {
      const dayWisePricing = config.dayWisePricing?.find(p => p.day === day.toLowerCase());
      const price = dayWisePricing?.fixedAmount || (dayWisePricing?.enabled ? config.basePrice * (dayWisePricing.priceMultiplier || 1) : config.basePrice);
      
      return {
        ticketType: config.ticketType,
        label: config.label,
        basePrice: config.basePrice,
        currentPrice: price,
        hasKids: config.hasKids,
        description: config.description,
        isActive: config.isActive
      };
    });
    
    const result = {
      success: true,
      data: dayPricing || []
    };
    
    res.json(result);
  } catch (error) {
    console.error('Ticket config pricing API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pricing information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/ticket-config/initialize - Initialize default ticket configurations (admin only)
router.post('/initialize', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Ticket config initialize API called successfully');
    
    // Check if configs already exist
    const existingConfigs = await TicketConfig.find();
    if (existingConfigs.length > 0) {
      return res.json({
        success: true,
        message: 'Ticket configurations already exist',
        data: existingConfigs
      });
    }
    
    // Create default configurations
    const defaultConfigs = [
      {
        ticketType: '100',
        basePrice: 100,
        label: 'Sitting Only',
        hasKids: false,
        description: 'Sitting arrangement without any activities',
        isActive: true,
        maxAdults: 10,
        maxKids: 0,
        timeLimit: 1,
        foodIncluded: false
      },
      {
        ticketType: '150',
        basePrice: 150,
        label: 'Without Food 1hr',
        hasKids: true,
        description: '1 hour access to park activities without food',
        isActive: true,
        maxAdults: 10,
        maxKids: 5,
        timeLimit: 1,
        foodIncluded: false
      },
      {
        ticketType: '300',
        basePrice: 300,
        label: 'Without Food 3-4hr',
        hasKids: true,
        description: '3-4 hours access to park activities without food',
        isActive: true,
        maxAdults: 10,
        maxKids: 5,
        timeLimit: 4,
        foodIncluded: false
      },
      {
        ticketType: '450',
        basePrice: 450,
        label: 'With Fast Food',
        hasKids: true,
        description: 'Full day access with fast food coupons',
        isActive: true,
        maxAdults: 10,
        maxKids: 5,
        timeLimit: 8,
        foodIncluded: true
      },
      {
        ticketType: '600',
        basePrice: 600,
        label: 'With Main Food',
        hasKids: true,
        description: 'Full day access with main food coupons',
        isActive: true,
        maxAdults: 10,
        maxKids: 5,
        timeLimit: 8,
        foodIncluded: true
      }
    ];
    
    const createdConfigs = await TicketConfig.insertMany(defaultConfigs);
    
    const result = {
      success: true,
      message: 'Default ticket configurations initialized successfully',
      data: createdConfigs
    };
    
    res.json(result);
  } catch (error) {
    console.error('Ticket config initialize API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to initialize configurations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
