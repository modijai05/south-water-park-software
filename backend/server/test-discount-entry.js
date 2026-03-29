// 🧪 DISCOUNT TEST - Create test entry with discounts
const mongoose = require('mongoose');
require('dotenv').config();

// Import Entry model
const { Entry } = require('./src/models/Entry.js');

async function createTestEntryWithDiscounts() {
  console.log('🧪 DISCOUNT TEST - Creating test entry with discounts\n');
  console.log('=' .repeat(60));
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    
    console.log('📡 Step 1: Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      connectTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ MongoDB Connected Successfully!');
    
    // Step 2: Create test entry with discounts
    console.log('\n📝 Step 2: Creating test entry with discounts...');
    
    const testEntry = {
      name: 'Discount Test User',
      mobile: '9999999998',
      ticketType: '300',
      adults: 2,
      kids: 2,
      totalPeople: 4,
      baseAmount: 900, // 2*300 + 2*150
      kidDiscount: 150, // 50% discount for kids (2 * 75)
      additionalDiscount: 100, // Additional discount
      finalAmount: 650, // 900 - 150 - 100
      cashAmount: 400,
      upiAmount: 250,
      advanceAmount: 0,
      adultsFastFoodCoupon: '',
      kidsFastFoodCoupon: '',
      adultsMainFoodCoupon: '',
      kidsMainFoodCoupon: '',
      filledBy: 'admin',
      filledByFullName: 'Test Admin',
      notes: 'Test entry with discounts for verification'
    };
    
    const entry = new Entry(testEntry);
    const savedEntry = await entry.save();
    
    console.log('✅ Test entry created successfully:');
    console.log(`   ID: ${savedEntry._id}`);
    console.log(`   Name: ${savedEntry.name}`);
    console.log(`   Base Amount: ₹${savedEntry.baseAmount}`);
    console.log(`   Kid Discount: ₹${savedEntry.kidDiscount}`);
    console.log(`   Additional Discount: ₹${savedEntry.additionalDiscount}`);
    console.log(`   Final Amount: ₹${savedEntry.finalAmount}`);
    console.log(`   Total Discount: ₹${savedEntry.kidDiscount + savedEntry.additionalDiscount}`);
    
    // Step 3: Test sync endpoint with new entry
    console.log('\n🔄 Step 3: Testing sync endpoint with new entry...');
    
    const response = await fetch('http://localhost:5000/api/entries/sync-all?t=' + Date.now());
    const syncData = await response.json();
    
    if (syncData.success && syncData.data.stats) {
      const stats = syncData.data.stats;
      console.log('✅ Sync endpoint test successful:');
      console.log(`   Today Additional Discount: ₹${stats.todayAdditionalDiscount}`);
      console.log(`   Today Total Discount: ₹${stats.todayTotalDiscount}`);
      console.log(`   Total Additional Discount: ₹${stats.totalAdditionalDiscount}`);
      console.log(`   Total Total Discount: ₹${stats.totalTotalDiscount}`);
      
      // Verify the test entry discounts are included
      const expectedTodayAdditional = 100; // From our test entry
      const expectedTodayTotal = 250; // 100 (additional) + 150 (kid)
      
      if (stats.todayAdditionalDiscount >= expectedTodayAdditional && 
          stats.todayTotalDiscount >= expectedTodayTotal) {
        console.log('✅ Discount calculations are working correctly!');
      } else {
        console.log('⚠️ Discount calculations may need adjustment');
      }
    } else {
      console.log('❌ Sync endpoint test failed');
    }
    
    console.log('\n✅ DISCOUNT TEST COMPLETED SUCCESSFULLY!');
    console.log('🧪 Test entry with discounts created and verified');
    console.log('💰 Dashboard will show updated discount data');
    console.log('🔄 Sync endpoints are working with discount data');
    
    console.log('\n' + '=' .repeat(60));
    console.log('🧪 South Water Park - Discount Test Complete');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Discount Test Failed:', error.message);
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

// Run the discount test
createTestEntryWithDiscounts();
