// Test MongoDB Data Flow for Entries
const mongoose = require('mongoose');
require('dotenv').config();

// Import Entry model
const { Entry } = require('./src/models/Entry.js');

async function testMongoDataFlow() {
  console.log('🔄 Testing MongoDB Data Flow for Entries...\n');
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      connectTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ MongoDB Connected Successfully!');
    console.log('🔗 Connection State:', mongoose.connection.readyState);
    console.log('📍 Database Name:', mongoose.connection.name);
    
    // Test 1: Create a test entry
    console.log('\n📝 Test 1: Creating Test Entry...');
    const testEntry = new Entry({
      name: 'MongoDB Test Customer',
      mobile: '9876543210',
      ticketType: '150',
      adults: 2,
      kids: 1,
      totalPeople: 3,
      baseAmount: 450,
      finalAmount: 450,
      cashAmount: 450,
      upiAmount: 0,
      advanceAmount: 0,
      filledBy: 'MongoDB Test',
      receiptNumber: 'MONGO_TEST_' + Date.now()
    });
    
    const savedEntry = await testEntry.save();
    console.log('✅ Test Entry Created Successfully!');
    console.log('🎫 Entry ID:', savedEntry._id);
    console.log('🧾 Receipt Number:', savedEntry.receiptNumber);
    console.log('📅 Created At:', savedEntry.createdAt);
    
    // Test 2: Read entries
    console.log('\n📖 Test 2: Reading Entries...');
    const allEntries = await Entry.find().sort({ createdAt: -1 }).limit(5);
    console.log('✅ Entries Retrieved Successfully!');
    console.log('📊 Total Entries Found:', allEntries.length);
    
    allEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.name} - ${entry.ticketType} - ₹${entry.finalAmount} - ${entry.receiptNumber}`);
    });
    
    // Test 3: Update entry
    console.log('\n📝 Test 3: Updating Entry...');
    const updatedEntry = await Entry.findByIdAndUpdate(
      savedEntry._id,
      { 
        name: 'Updated MongoDB Test Customer',
        notes: 'Updated via MongoDB test'
      },
      { new: true }
    );
    console.log('✅ Entry Updated Successfully!');
    console.log('🔄 Updated Name:', updatedEntry.name);
    console.log('📝 Notes Added:', updatedEntry.notes);
    
    // Test 4: Aggregate data (like stats endpoint)
    console.log('\n🧮 Test 4: Aggregating Data (Stats Simulation)...');
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const todayStats = await Entry.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lt: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          todayEntries: { $sum: 1 },
          todayAmount: { $sum: '$finalAmount' },
          todayCash: { $sum: '$cashAmount' },
          todayUpi: { $sum: '$upiAmount' },
          todayAdvance: { $sum: '$advanceAmount' },
          todayPeople: { $sum: { $add: ['$adults', '$kids'] } },
          todayAdults: { $sum: '$adults' },
          todayKids: { $sum: '$kids' }
        }
      }
    ]);
    
    const allTimeStats = await Entry.aggregate([
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' },
          totalCash: { $sum: '$cashAmount' },
          totalUpi: { $sum: '$upiAmount' },
          totalAdvance: { $sum: '$advanceAmount' },
          totalPeople: { $sum: { $add: ['$adults', '$kids'] } },
          totalAdults: { $sum: '$adults' },
          totalKids: { $sum: '$kids' }
        }
      }
    ]);
    
    console.log('✅ Data Aggregation Successful!');
    console.log('📊 Today Stats:', todayStats[0] || 'No entries today');
    console.log('📊 All-Time Stats:', allTimeStats[0] || 'No entries found');
    
    // Test 5: Ticket type distribution
    console.log('\n🎫 Test 5: Ticket Type Distribution...');
    const ticketDistribution = await Entry.aggregate([
      {
        $group: {
          _id: '$ticketType',
          count: { $sum: 1 },
          revenue: { $sum: '$finalAmount' },
          adults: { $sum: '$adults' },
          kids: { $sum: '$kids' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('✅ Ticket Distribution Calculated!');
    ticketDistribution.forEach(ticket => {
      console.log(`   ${ticket._id}: ${ticket.count} entries, ₹${ticket.revenue} revenue, ${ticket.adults} adults, ${ticket.kids} kids`);
    });
    
    // Test 6: Delete test entry (cleanup)
    console.log('\n🗑️ Test 6: Cleaning Up Test Entry...');
    await Entry.findByIdAndDelete(savedEntry._id);
    console.log('✅ Test Entry Deleted Successfully!');
    
    console.log('\n🎉 All MongoDB Data Flow Tests Passed!');
    console.log('✅ MongoDB is properly connected and entries data is flowing correctly.');
    console.log('🔄 The enhanced sync and export functionality will work properly with this database connection.');
    
  } catch (error) {
    console.error('❌ MongoDB Data Flow Test Failed:', error.message);
    console.error('🔍 Error Details:', error);
    console.error('📍 Stack Trace:', error.stack);
  } finally {
    // Close connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 MongoDB Connection Closed');
    }
  }
}

// Run the test
testMongoDataFlow();
