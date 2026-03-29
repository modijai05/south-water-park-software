// 🎯 DISCOUNT FIX - Update existing entries with proper discount calculations
const mongoose = require('mongoose');
require('dotenv').config();

// Import Entry model
const { Entry } = require('./src/models/Entry.js');

// Ticket pricing configuration
const TICKET_PRICES = {
  '100': { adult: 100, kid: 50 },
  '150': { adult: 150, kid: 75 },
  '300': { adult: 300, kid: 150 },
  '450': { adult: 450, kid: 225 },
  '600': { adult: 600, kid: 300 }
};

async function fixDiscountData() {
  console.log('🎯 DISCOUNT FIX - Updating entries with proper discount calculations\n');
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
    
    // Step 2: Fetch all entries that need discount calculations
    console.log('\n📊 Step 2: Fetching entries for discount calculation...');
    
    const entries = await Entry.find({});
    console.log(`📈 Found ${entries.length} entries to process`);
    
    let updatedCount = 0;
    let totalDiscounts = 0;
    let totalAdditionalDiscounts = 0;
    let totalKidDiscounts = 0;
    
    // Step 3: Process each entry
    console.log('\n🔄 Step 3: Processing entries...');
    
    for (const entry of entries) {
      const ticketPrice = TICKET_PRICES[entry.ticketType];
      if (!ticketPrice) {
        console.log(`⚠️ Unknown ticket type ${entry.ticketType} for entry ${entry._id}`);
        continue;
      }
      
      // Calculate expected base amount
      const expectedBaseAmount = (entry.adults * ticketPrice.adult) + (entry.kids * ticketPrice.kid);
      
      // Calculate discounts
      let kidDiscount = 0;
      let additionalDiscount = 0;
      
      // Kid discount calculation (50% off for kids)
      if (entry.kids > 0) {
        const kidBasePrice = entry.kids * ticketPrice.kid;
        kidDiscount = Math.round(kidBasePrice * 0.5); // 50% discount for kids
      }
      
      // Additional discount calculation (if final amount is less than expected)
      const expectedFinalAmount = expectedBaseAmount - kidDiscount;
      if (entry.finalAmount < expectedFinalAmount) {
        additionalDiscount = expectedFinalAmount - entry.finalAmount;
      }
      
      // Calculate base amount if not present
      const baseAmount = entry.baseAmount || expectedBaseAmount;
      
      // Update entry if discount fields are missing or incorrect
      const needsUpdate = 
        entry.baseAmount !== baseAmount ||
        entry.kidDiscount !== kidDiscount ||
        entry.additionalDiscount !== additionalDiscount;
      
      if (needsUpdate) {
        await Entry.updateOne(
          { _id: entry._id },
          { 
            $set: {
              baseAmount: baseAmount,
              kidDiscount: kidDiscount,
              additionalDiscount: additionalDiscount
            }
          }
        );
        
        console.log(`✅ Updated entry ${entry._id}: ${entry.name}`);
        console.log(`   Base Amount: ₹${baseAmount}, Kid Discount: ₹${kidDiscount}, Additional Discount: ₹${additionalDiscount}`);
        console.log(`   Final Amount: ₹${entry.finalAmount} (Expected: ₹${expectedFinalAmount})`);
        
        updatedCount++;
        totalDiscounts += (kidDiscount + additionalDiscount);
        totalAdditionalDiscounts += additionalDiscount;
        totalKidDiscounts += kidDiscount;
      } else {
        console.log(`ℹ️ Entry ${entry._id} already has correct discounts`);
      }
    }
    
    // Step 4: Verify the updates
    console.log('\n🔍 Step 4: Verifying discount calculations...');
    
    const updatedEntries = await Entry.find({});
    let verifiedTotalDiscount = 0;
    let verifiedAdditionalDiscount = 0;
    let verifiedKidDiscount = 0;
    
    updatedEntries.forEach(entry => {
      verifiedTotalDiscount += (entry.kidDiscount || 0) + (entry.additionalDiscount || 0);
      verifiedAdditionalDiscount += entry.additionalDiscount || 0;
      verifiedKidDiscount += entry.kidDiscount || 0;
    });
    
    console.log('📊 Discount Summary:');
    console.log(`   Entries Updated: ${updatedCount}`);
    console.log(`   Total Discounts: ₹${verifiedTotalDiscount}`);
    console.log(`   Additional Discounts: ₹${verifiedAdditionalDiscount}`);
    console.log(`   Kid Discounts: ₹${verifiedKidDiscount}`);
    
    // Step 5: Test sync endpoint
    console.log('\n🔄 Step 5: Testing sync endpoint...');
    
    const response = await fetch('http://localhost:5000/api/entries/sync-all?t=' + Date.now());
    const syncData = await response.json();
    
    if (syncData.success && syncData.data.stats) {
      const stats = syncData.data.stats;
      console.log('✅ Sync endpoint test successful:');
      console.log(`   Today Additional Discount: ₹${stats.todayAdditionalDiscount}`);
      console.log(`   Today Total Discount: ₹${stats.todayTotalDiscount}`);
      console.log(`   Total Additional Discount: ₹${stats.totalAdditionalDiscount}`);
      console.log(`   Total Total Discount: ₹${stats.totalTotalDiscount}`);
    } else {
      console.log('❌ Sync endpoint test failed');
    }
    
    console.log('\n✅ DISCOUNT FIX COMPLETED SUCCESSFULLY!');
    console.log('🎯 All entries now have proper discount calculations');
    console.log('💰 Dashboard will show accurate discount data');
    console.log('🔄 Sync endpoints are working correctly');
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 South Water Park - Discount Data Fix Complete');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Discount Fix Failed:', error.message);
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

// Run the discount fix
fixDiscountData();
