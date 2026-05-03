/**
 * MongoDB Migration Script: Add New 2-Hour Ticket (Type '200')
 * Price: ₹300, Kids allowed, 2 hour time limit
 * This script adds the new ticket configuration to the TicketConfig collection
 */

const mongoose = require('mongoose');

// MongoDB connection string - update if needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/southwaterpark';

// Ticket configuration for the new 2-hour ticket
const newTicketConfig = {
  ticketType: '200',
  basePrice: 300,
  label: 'Without Food 2hr',
  hasKids: true,
  description: '2 hours access to park activities without food',
  isActive: true,
  maxAdults: 10,
  maxKids: 5,
  timeLimit: 2,
  foodIncluded: false,
  dayWisePricing: [
    { day: 'monday', priceMultiplier: 1.0, enabled: true },
    { day: 'tuesday', priceMultiplier: 1.0, enabled: true },
    { day: 'wednesday', priceMultiplier: 1.0, enabled: true },
    { day: 'thursday', priceMultiplier: 1.0, enabled: true },
    { day: 'friday', priceMultiplier: 1.0, enabled: true },
    { day: 'saturday', priceMultiplier: 1.0, enabled: true },
    { day: 'sunday', priceMultiplier: 1.0, enabled: true }
  ]
};

async function addTicket200() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Define TicketConfig schema inline for this script
    const TicketConfigSchema = new mongoose.Schema({
      ticketType: { type: String, required: true, unique: true },
      basePrice: { type: Number, required: true },
      label: { type: String, required: true },
      hasKids: { type: Boolean, default: true },
      description: { type: String },
      isActive: { type: Boolean, default: true },
      maxAdults: { type: Number, default: 10 },
      maxKids: { type: Number, default: 5 },
      timeLimit: { type: Number },
      foodIncluded: { type: Boolean, default: false },
      dayWisePricing: [{
        day: { type: String },
        priceMultiplier: { type: Number, default: 1.0 },
        fixedAmount: { type: Number },
        enabled: { type: Boolean, default: true }
      }]
    }, {
      timestamps: true
    });

    const TicketConfig = mongoose.model('TicketConfig', TicketConfigSchema);

    // Check if ticket '200' already exists
    const existingConfig = await TicketConfig.findOne({ ticketType: '200' });
    
    if (existingConfig) {
      console.log('ℹ️ Ticket type 200 already exists in database:', existingConfig);
      
      // Update the existing config with the latest values
      const updated = await TicketConfig.findOneAndUpdate(
        { ticketType: '200' },
        { 
          $set: {
            basePrice: 300,
            label: 'Without Food 2hr',
            hasKids: true,
            description: '2 hours access to park activities without food',
            isActive: true,
            maxAdults: 10,
            maxKids: 5,
            timeLimit: 2,
            foodIncluded: false
          }
        },
        { new: true }
      );
      console.log('✅ Updated existing ticket 200 configuration:', updated);
    } else {
      // Create new ticket config
      const created = await TicketConfig.create(newTicketConfig);
      console.log('✅ Created new ticket 200 configuration:', created);
    }

    // Verify all ticket configs
    const allConfigs = await TicketConfig.find().sort({ ticketType: 1 });
    console.log('\n📋 All Ticket Configurations:');
    allConfigs.forEach(config => {
      console.log(`  - ${config.ticketType}: ${config.label} (₹${config.basePrice}, Kids: ${config.hasKids})`);
    });

    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
addTicket200();
