// 🧹 CLEANUP: Remove test entries and keep only real entries
const mongoose = require('mongoose');

async function cleanupTestEntries() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
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
    
    const { Entry } = require('./src/models/Entry.js');
    
    // Get all entries
    const allEntries = await Entry.find().sort({ createdAt: -1 });
    console.log(`📊 Current entries in database: ${allEntries.length}`);
    
    if (allEntries.length > 0) {
      console.log('📋 All entries:');
      allEntries.forEach((entry, i) => {
        const isTest = entry.name.includes('Test') || 
                      entry.name.includes('John Smith') || 
                      entry.name.includes('Sarah Johnson') ||
                      entry.name.includes('Mike Wilson') ||
                      entry.name.includes('Emily Davis');
        
        console.log(`  ${i+1}. ${entry.name} - ${entry.ticketType} - ₹${entry.finalAmount} - ${entry.receiptNumber} ${isTest ? '(TEST - DELETE)' : '(KEEP)'}`);
      });
      
      // Delete test entries
      const testEntries = allEntries.filter(entry => 
        entry.name.includes('Test') || 
        entry.name.includes('John Smith') || 
        entry.name.includes('Sarah Johnson') ||
        entry.name.includes('Mike Wilson') ||
        entry.name.includes('Emily Davis')
      );
      
      if (testEntries.length > 0) {
        console.log(`\n🗑️ Deleting ${testEntries.length} test entries...`);
        
        for (const testEntry of testEntries) {
          await Entry.deleteOne({ _id: testEntry._id });
          console.log(`  🗑️ Deleted: ${testEntry.name} - ${testEntry.receiptNumber}`);
        }
      }
    }
    
    // Check final state
    const finalEntries = await Entry.find().sort({ createdAt: -1 });
    console.log(`\n📊 Final entries after cleanup: ${finalEntries.length}`);
    
    if (finalEntries.length > 0) {
      console.log('📋 Remaining real entries:');
      finalEntries.forEach((entry, i) => {
        console.log(`  ${i+1}. ${entry.name} - ${entry.ticketType} - ₹${entry.finalAmount} - ${entry.receiptNumber}`);
      });
    } else {
      console.log('📋 No real entries found - database is clean');
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Test entries cleanup completed successfully');
    console.log('🎯 READY FOR PRODUCTION: Only real entries remain');
    
  } catch (error) {
    console.error('❌ Error cleaning up test entries:', error.message);
  }
}

cleanupTestEntries();
