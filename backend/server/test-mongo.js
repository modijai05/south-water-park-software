const mongoose = require('mongoose');

async function testMongoConnection() {
  try {
    console.log('🔍 Testing MongoDB connection...');
    
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
    
    // Test database operations
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📁 Available collections:', collections.map(c => c.name));
    
    // Test Entry collection
    if (collections.find(c => c.name === 'entries')) {
      const entryCount = await db.collection('entries').countDocuments();
      console.log(`📊 Entries collection has ${entryCount} documents`);
    }
    
    // Test TicketConfig collection
    if (collections.find(c => c.name === 'ticketconfigs')) {
      const ticketConfigCount = await db.collection('ticketconfigs').countDocuments();
      console.log(`🎫 TicketConfigs collection has ${ticketConfigCount} documents`);
      
      // Show sample ticket configs
      const sampleConfigs = await db.collection('ticketconfigs').find().limit(3).toArray();
      console.log('🎫 Sample ticket configs:', sampleConfigs.map(c => ({
        ticketType: c.ticketType,
        basePrice: c.basePrice,
        label: c.label,
        isActive: c.isActive
      })));
    }
    
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
}

testMongoConnection();
