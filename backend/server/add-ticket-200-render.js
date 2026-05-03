/**
 * MongoDB Migration Script for Render Database
 * Add New 2-Hour Ticket (Type '200')
 */

const mongoose = require('mongoose');

// Render's MongoDB connection string from render.yaml
const MONGODB_URI = 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';

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
    console.log('🔗 Connecting to Render MongoDB...');
    console.log('URI:', MONGODB_URI.replace(/:.*@/, ':****@'));
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

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
    }, { timestamps: true });

    const TicketConfig = mongoose.model('TicketConfig', TicketConfigSchema);

    // Check if ticket '200' already exists
    const existing = await TicketConfig.findOne({ ticketType: '200' });
    
    if (existing) {
      console.log('ℹ️ Ticket 200 already exists:', existing);
    } else {
      console.log('📝 Creating new ticket 200...');
      const created = await TicketConfig.create(newTicketConfig);
      console.log('✅ Created ticket 200:', created._id);
    }

    // Verify all tickets
    const all = await TicketConfig.find().sort({ ticketType: 1 });
    console.log('\n📋 All Tickets:');
    all.forEach(t => console.log(`  - ${t.ticketType}: ${t.label} (₹${t.basePrice})`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

addTicket200();
