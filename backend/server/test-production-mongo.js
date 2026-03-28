const mongoose = require('mongoose');

async function testProductionMongo() {
  try {
    console.log('🔗 Testing Production MongoDB Connection...');
    
    // Use the same connection string as Render
    const mongoUri = 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      connectTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ MongoDB connected successfully!');
    
    // Test database operations
    const db = mongoose.connection.db;
    
    // Check collections
    const collections = await db.listCollections().toArray();
    console.log('📁 Available Collections:', collections.map(c => c.name));
    
    // Check entries
    const entriesCount = await db.collection('entries').countDocuments();
    console.log(`📊 Total entries in database: ${entriesCount}`);
    
    // Get recent entries
    const recentEntries = await db.collection('entries').find().limit(3).toArray();
    console.log('📋 Recent Entries:');
    recentEntries.forEach((entry, i) => {
      console.log(`  ${i+1}. ${entry.name} - ${entry.ticketType} - ₹${entry.finalAmount} - ${entry.receiptNumber}`);
    });
    
    await mongoose.connection.close();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testProductionMongo();
