const mongoose = require('mongoose');
const { TicketConfig } = require('./src/models/TicketConfig.js');

async function initializeDatabase() {
  try {
    console.log('🔍 Initializing MongoDB database...');
    
    const mongoUri = 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      connectTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ MongoDB Connected Successfully!');
    
    // Check if ticket configs already exist
    const existingConfigs = await TicketConfig.find();
    console.log(`📋 Found ${existingConfigs.length} existing ticket configurations`);
    
    if (existingConfigs.length === 0) {
      console.log('📝 Creating default ticket configurations...');
      
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
          basePrice: 350,
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
          basePrice: 500,
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
          basePrice: 700,
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
      console.log(`✅ Created ${createdConfigs.length} default ticket configurations`);
      
      createdConfigs.forEach(config => {
        console.log(`🎫 ${config.ticketType}: ${config.label} - ₹${config.basePrice}`);
      });
    } else {
      console.log('📋 Ticket configurations already exist:');
      existingConfigs.forEach(config => {
        console.log(`🎫 ${config.ticketType}: ${config.label} - ₹${config.basePrice} (${config.isActive ? 'Active' : 'Inactive'})`);
      });
    }
    
    await mongoose.connection.close();
    console.log('🔌 Database initialization completed');
    
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    process.exit(1);
  }
}

initializeDatabase();
