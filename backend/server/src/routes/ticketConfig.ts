import { Router } from 'express';
import { TicketConfig, ITicketConfig } from '../models/TicketConfig.js';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all ticket configurations
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    console.log('🔄 Server: Fetching all ticket configs...');
    const configs = await TicketConfig.find().sort({ ticketType: 1 });
    console.log('✅ Server: Found configs:', configs.length);
    configs.forEach(config => {
      console.log(`  - ${config.ticketType}: ₹${config.basePrice} (${config.label}) - Kids: ${config.hasKids ? 'Yes' : 'No'} - Active: ${config.isActive}`);
    });
    res.json(configs);
  } catch (error) {
    console.error('❌ Server: Error fetching ticket configs:', error);
    res.status(500).json({ message: 'Failed to fetch ticket configurations' });
  }
});

// Export ticket configurations to Excel format
router.get('/export', authenticate, async (req: AuthRequest, res) => {
  try {
    console.log('🔄 Server: Exporting ticket configurations to Excel...');
    
    const configs = await TicketConfig.find().sort({ ticketType: 1 });
    
    // Prepare data for Excel export
    const excelData = configs.map(config => {
      const dayWiseData: any = {
        'Ticket Type': config.ticketType,
        'Label': config.label,
        'Base Price': config.basePrice,
        'Has Kids': config.hasKids ? 'Yes' : 'No',
        'Description': config.description,
        'Max Adults': config.maxAdults || '',
        'Max Kids': config.maxKids || '',
        'Time Limit (hours)': config.timeLimit || '',
        'Food Included': config.foodIncluded ? 'Yes' : 'No',
        'Active': config.isActive ? 'Yes' : 'No'
      };
      
      // Add day-wise pricing columns
      config.dayWisePricing.forEach(dayPricing => {
        const dayName = dayPricing.day.charAt(0).toUpperCase() + dayPricing.day.slice(1);
        
        if (dayPricing.enabled) {
          if (dayPricing.fixedAmount !== undefined) {
            dayWiseData[`${dayName} Price`] = dayPricing.fixedAmount;
            dayWiseData[`${dayName} Type`] = 'Fixed';
          } else {
            dayWiseData[`${dayName} Price`] = Math.round(config.basePrice * dayPricing.priceMultiplier);
            dayWiseData[`${dayName} Type`] = `Multiplier (${dayPricing.priceMultiplier}x)`;
          }
        } else {
          dayWiseData[`${dayName} Price`] = config.basePrice;
          dayWiseData[`${dayName} Type`] = 'Disabled';
        }
        
        dayWiseData[`${dayName} Enabled`] = dayPricing.enabled ? 'Yes' : 'No';
      });
      
      return dayWiseData;
    });
    
    console.log('✅ Server: Ticket config Excel data prepared:', excelData.length, 'records');
    res.json(excelData);
    
  } catch (error) {
    console.error('❌ Server: Error exporting ticket configs:', error);
    res.status(500).json({ message: 'Failed to export ticket configurations' });
  }
});

// Get current pricing for a specific day
router.get('/pricing/:day', async (req, res) => {
  try {
    const day = req.params.day.toLowerCase();
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    if (!validDays.includes(day)) {
      return res.status(400).json({ message: 'Invalid day' });
    }

    const configs = await TicketConfig.find({ isActive: true });
    const pricing = configs.map(config => {
      const dayPricing = config.dayWisePricing.find(dp => dp.day === day && dp.enabled);
      let finalPrice = config.basePrice;
      
      if (dayPricing) {
        if (dayPricing.fixedAmount !== undefined) {
          finalPrice = dayPricing.fixedAmount;
        } else {
          finalPrice = Math.round(config.basePrice * dayPricing.priceMultiplier);
        }
      }

      return {
        ticketType: config.ticketType,
        label: config.label,
        basePrice: config.basePrice,
        finalPrice,
        hasKids: config.hasKids,
        description: config.description,
        dayPricing
      };
    });

    res.json(pricing);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ message: 'Failed to fetch pricing' });
  }
});

// Get single ticket configuration
router.get('/:ticketType', authenticate, async (req: AuthRequest, res) => {
  try {
    const config = await TicketConfig.findOne({ ticketType: req.params.ticketType });
    if (!config) {
      return res.status(404).json({ message: 'Ticket configuration not found' });
    }
    res.json(config);
  } catch (error) {
    console.error('Error fetching ticket config:', error);
    res.status(500).json({ message: 'Failed to fetch ticket configuration' });
  }
});

// Create or update ticket configuration
router.put('/:ticketType', authenticate, async (req: AuthRequest, res) => {
  try {
    console.log(`🔄 Server: Updating ticket config for ${req.params.ticketType}...`);
    console.log('📝 Server: Request body:', req.body);
    
    const {
      basePrice,
      label,
      hasKids,
      description,
      dayWisePricing,
      isActive,
      maxAdults,
      maxKids,
      timeLimit,
      foodIncluded
    } = req.body;

    const config = await TicketConfig.findOneAndUpdate(
      { ticketType: req.params.ticketType },
      {
        ticketType: req.params.ticketType,
        basePrice,
        label,
        hasKids,
        description,
        dayWisePricing,
        isActive,
        maxAdults,
        maxKids,
        timeLimit,
        foodIncluded
      },
      { upsert: true, new: true, runValidators: true }
    );

    console.log('✅ Server: Config updated successfully:', config);
    res.json(config);
  } catch (error) {
    console.error('❌ Server: Error updating ticket config:', error);
    res.status(500).json({ message: 'Failed to update ticket configuration' });
  }
});

// Delete ticket configuration
router.delete('/:ticketType', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await TicketConfig.deleteOne({ ticketType: req.params.ticketType });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Ticket configuration not found' });
    }
    res.json({ message: 'Ticket configuration deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket config:', error);
    res.status(500).json({ message: 'Failed to delete ticket configuration' });
  }
});

// Update ticket configurations from Excel
router.post('/import', authenticate, async (req: AuthRequest, res) => {
  try {
    console.log('🔄 Server: Importing ticket configurations from Excel...');
    console.log('📝 Server: Request body length:', req.body?.length || 0);
    
    const excelData = req.body;
    if (!Array.isArray(excelData)) {
      return res.status(400).json({ message: 'Invalid data format. Expected array.' });
    }
    
    const updateResults = [];
    
    for (const row of excelData) {
      try {
        const ticketType = row['Ticket Type'];
        if (!ticketType) {
          console.log('⚠️ Server: Skipping row without ticket type');
          continue;
        }
        
        // Reconstruct day-wise pricing from Excel data
        const dayWisePricing: any[] = [];
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        days.forEach(day => {
          const dayName = day.charAt(0).toUpperCase() + day.slice(1);
          const priceColumn = `${dayName} Price`;
          const typeColumn = `${dayName} Type`;
          const enabledColumn = `${dayName} Enabled`;
          
          const dayPricing: any = {
            day: day as any,
            enabled: row[enabledColumn] === 'Yes'
          };
          
          if (row[priceColumn] !== undefined && row[priceColumn] !== '') {
            const price = Number(row[priceColumn]);
            const type = row[typeColumn];
            
            if (type && type.includes('Multiplier')) {
              const multiplierMatch = type.match(/\(([^)]+)x\)/);
              if (multiplierMatch) {
                dayPricing.priceMultiplier = parseFloat(multiplierMatch[1]);
              } else {
                // Calculate multiplier from price
                const basePrice = Number(row['Base Price']);
                dayPricing.priceMultiplier = basePrice > 0 ? price / basePrice : 1.0;
              }
            } else if (type === 'Fixed') {
              dayPricing.fixedAmount = price;
            } else {
              // Default to multiplier if type is unclear
              const basePrice = Number(row['Base Price']);
              dayPricing.priceMultiplier = basePrice > 0 ? price / basePrice : 1.0;
            }
          } else {
            dayPricing.priceMultiplier = 1.0;
          }
          
          dayWisePricing.push(dayPricing);
        });
        
        // Update ticket configuration
        const config = await TicketConfig.findOneAndUpdate(
          { ticketType },
          {
            ticketType,
            basePrice: Number(row['Base Price']) || 0,
            label: row['Label'] || '',
            hasKids: row['Has Kids'] === 'Yes',
            description: row['Description'] || '',
            dayWisePricing,
            isActive: row['Active'] === 'Yes',
            maxAdults: row['Max Adults'] ? Number(row['Max Adults']) : undefined,
            maxKids: row['Max Kids'] ? Number(row['Max Kids']) : undefined,
            timeLimit: row['Time Limit (hours)'] ? Number(row['Time Limit (hours)']) : undefined,
            foodIncluded: row['Food Included'] === 'Yes'
          },
          { upsert: true, new: true, runValidators: true }
        );
        
        updateResults.push({
          ticketType,
          success: true,
          message: 'Updated successfully'
        });
        
        console.log(`✅ Server: Updated ticket config ${ticketType}`);
        
      } catch (error) {
        console.error(`❌ Server: Error updating row for ${row['Ticket Type']}:`, error);
        updateResults.push({
          ticketType: row['Ticket Type'] || 'Unknown',
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Trigger global update event
    (globalThis as any).io?.emit('ticket-config-updated', {
      timestamp: new Date().toISOString(),
      source: 'excel-import',
      updatedCount: updateResults.filter(r => r.success).length
    });
    
    console.log('✅ Server: Ticket config import completed:', updateResults.length, 'records processed');
    
    res.json({
      message: 'Ticket configurations imported successfully',
      results: updateResults,
      totalProcessed: updateResults.length,
      successCount: updateResults.filter(r => r.success).length,
      failureCount: updateResults.filter(r => !r.success).length
    });
    
  } catch (error) {
    console.error('❌ Server: Error importing ticket configs:', error);
    res.status(500).json({ message: 'Failed to import ticket configurations' });
  }
});

// Initialize default ticket configurations
router.post('/initialize', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const defaultTickets = [
      {
        ticketType: '100',
        basePrice: 100,
        label: 'Special ticket with Sitting Only',
        hasKids: false,
        description: 'Sitting arrangement only, no access to water activities',
        dayWisePricing: [
          { day: 'monday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'tuesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'wednesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'thursday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'friday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'saturday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'sunday' as const, priceMultiplier: 1.0, enabled: true }
        ],
        timeLimit: 2,
        foodIncluded: false
      },
      {
        ticketType: '150',
        basePrice: 150,
        label: '₹150 – Special ticket',
        hasKids: false,
        description: 'Special entry ticket, adults only',
        dayWisePricing: [
          { day: 'monday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'tuesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'wednesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'thursday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'friday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'saturday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'sunday' as const, priceMultiplier: 1.0, enabled: true }
        ],
        timeLimit: 2,
        foodIncluded: false
      },
      {
        ticketType: '300',
        basePrice: 350,
        label: '₹350 – 3-4hr access',
        hasKids: true,
        description: 'Full access to water activities for 3-4 hours',
        dayWisePricing: [
          { day: 'monday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'tuesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'wednesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'thursday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'friday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'saturday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'sunday' as const, priceMultiplier: 1.0, enabled: true }
        ],
        timeLimit: 4,
        foodIncluded: false
      },
      {
        ticketType: '450',
        basePrice: 500,
        label: '₹500 – Fast food + 3-4hr access',
        hasKids: true,
        description: 'Fast food coupon + full water activities access',
        dayWisePricing: [
          { day: 'monday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'tuesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'wednesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'thursday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'friday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'saturday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'sunday' as const, priceMultiplier: 1.0, enabled: true }
        ],
        timeLimit: 4,
        foodIncluded: true
      },
      {
        ticketType: '600',
        basePrice: 700,
        label: '₹700 – Main food + 3-4hr access',
        hasKids: true,
        description: 'Main food coupon + full water activities access',
        dayWisePricing: [
          { day: 'monday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'tuesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'wednesday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'thursday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'friday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'saturday' as const, priceMultiplier: 1.0, enabled: true },
          { day: 'sunday' as const, priceMultiplier: 1.0, enabled: true }
        ],
        timeLimit: 4,
        foodIncluded: true
      }
    ];

    for (const ticket of defaultTickets) {
      await TicketConfig.findOneAndUpdate(
        { ticketType: ticket.ticketType },
        ticket,
        { upsert: true, new: true }
      );
    }

    res.json({ message: 'Default ticket configurations initialized successfully' });
  } catch (error) {
    console.error('Error initializing ticket configs:', error);
    res.status(500).json({ message: 'Failed to initialize ticket configurations' });
  }
});

export default router;
