// Test MongoDB Connection and Entries Data Flow
const mongoose = require('mongoose');
require('dotenv').config();

// Import Entry model
const { Entry } = require('./src/models/Entry.js');

async function testMongoConnection() {
  console.log('🔄 Testing MongoDB Connection and Entries Data Flow...\n');
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/?appName=Cluster';
    
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected Successfully!');
    console.log('🔗 Connection State:', mongoose.connection.readyState);
    console.log('📍 Database Name:', mongoose.connection.name);
    
    // Test Entry model operations
    console.log('\n📊 Testing Entry Model Operations...');
    
    // Count total entries
    const totalEntries = await Entry.countDocuments();
    console.log('📈 Total Entries in Database:', totalEntries);
    
    // Get today's entries
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const todayEntries = await Entry.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    console.log('📅 Today\'s Entries:', todayEntries);
    
    // Get recent entries (last 5)
    const recentEntries = await Entry.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name mobile ticketType adults kids finalAmount createdAt receiptNumber');
    
    console.log('\n📋 Recent Entries (Last 5):');
    recentEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.name} - ${entry.ticketType} - ₹${entry.finalAmount} - ${entry.createdAt}`);
    });
    
    // Test data aggregation for stats
    console.log('\n🧮 Testing Data Aggregation...');
    const stats = await Entry.aggregate([
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' },
          totalPeople: { $sum: { $add: ['$adults', '$kids'] } },
          totalAdults: { $sum: '$adults' },
          totalKids: { $sum: '$kids' }
        }
      }
    ]);
    
    if (stats.length > 0) {
      console.log('📊 Database Statistics:');
      console.log(`   Total Entries: ${stats[0].totalEntries}`);
      console.log(`   Total Revenue: ₹${stats[0].totalAmount}`);
      console.log(`   Total People: ${stats[0].totalPeople}`);
      console.log(`   Total Adults: ${stats[0].totalAdults}`);
      console.log(`   Total Kids: ${stats[0].totalKids}`);
    }
    
    // Test ticket type distribution
    const ticketDistribution = await Entry.aggregate([
      {
        $group: {
          _id: '$ticketType',
          count: { $sum: 1 },
          revenue: { $sum: '$finalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('\n🎫 Ticket Type Distribution:');
    ticketDistribution.forEach(ticket => {
      console.log(`   ${ticket._id}: ${ticket.count} entries, ₹${ticket.revenue} revenue`);
    });
    
    // Test payment method distribution
    const paymentDistribution = await Entry.aggregate([
      {
        $group: {
          _id: null,
          totalCash: { $sum: '$cashAmount' },
          totalUPI: { $sum: '$upiAmount' },
          totalAdvance: { $sum: '$advanceAmount' }
        }
      }
    ]);
    
    if (paymentDistribution.length > 0) {
      console.log('\n💳 Payment Method Distribution:');
      console.log(`   Cash: ₹${paymentDistribution[0].totalCash}`);
      console.log(`   UPI: ₹${paymentDistribution[0].totalUPI}`);
      console.log(`   Advance: ₹${paymentDistribution[0].totalAdvance}`);
    }
    
    console.log('\n✅ All MongoDB Tests Passed Successfully!');
    console.log('🔄 Database is properly connected and entries are flowing correctly.');
    
  } catch (error) {
    console.error('❌ MongoDB Connection Test Failed:', error.message);
    console.error('🔍 Error Details:', error);
  } finally {
    // Close connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 MongoDB Connection Closed');
    }
  }
}

// Run the test
testMongoConnection();
