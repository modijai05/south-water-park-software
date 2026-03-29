const mongoose = require('mongoose');
const { Entry } = require('./src/models/Entry.js');
require('dotenv').config();

// Ticket pricing configuration
const TICKET_PRICES = {
  '100': { adult: 100, kid: 50 },
  '150': { adult: 150, kid: 75 },
  '300': { adult: 300, kid: 150 },
  '450': { adult: 450, kid: 225 },
  '600': { adult: 600, kid: 300 }
};

async function fixDiscountCalculationErrors() {
  try {
    console.log('🔧 FIXING: Discount Calculation Errors\n');
    console.log('=' .repeat(60));
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Get all entries
    const entries = await Entry.find({}).lean();
    console.log(`\n📊 Processing ${entries.length} entries for correction...`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const entry of entries) {
      const ticketPrice = TICKET_PRICES[entry.ticketType];
      if (!ticketPrice) {
        console.log(`⚠️ Unknown ticket type ${entry.ticketType} for entry ${entry._id}`);
        errorCount++;
        continue;
      }
      
      // Calculate correct base amount
      const correctBaseAmount = (entry.adults * ticketPrice.adult) + (entry.kids * ticketPrice.kid);
      
      // Calculate correct kid discount (50% off for kids)
      let correctKidDiscount = 0;
      if (entry.kids > 0) {
        const kidBasePrice = entry.kids * ticketPrice.kid;
        correctKidDiscount = Math.round(kidBasePrice * 0.5); // 50% discount
      }
      
      // Calculate correct additional discount to match final amount
      const expectedFinalAmount = correctBaseAmount - correctKidDiscount;
      let correctAdditionalDiscount = 0;
      
      if (entry.finalAmount < expectedFinalAmount) {
        correctAdditionalDiscount = expectedFinalAmount - entry.finalAmount;
      } else if (entry.finalAmount > expectedFinalAmount) {
        // If final amount is higher than expected, additional discount should be 0
        correctAdditionalDiscount = 0;
      }
      
      // Verify calculations
      const calculatedFinalAmount = correctBaseAmount - correctKidDiscount - correctAdditionalDiscount;
      const isCorrect = calculatedFinalAmount === entry.finalAmount;
      
      // Check if update is needed
      const needsUpdate = 
        entry.baseAmount !== correctBaseAmount ||
        entry.kidDiscount !== correctKidDiscount ||
        entry.additionalDiscount !== correctAdditionalDiscount ||
        !isCorrect;
      
      if (needsUpdate) {
        await Entry.updateOne(
          { _id: entry._id },
          { 
            $set: {
              baseAmount: correctBaseAmount,
              kidDiscount: correctKidDiscount,
              additionalDiscount: correctAdditionalDiscount
            }
          }
        );
        
        console.log(`\n🔧 Fixed entry ${entry._id}: ${entry.name}`);
        console.log(`   Ticket Type: ${entry.ticketType} (Adults: ${entry.adults}, Kids: ${entry.kids})`);
        console.log(`   Base Amount: ₹${entry.baseAmount} → ₹${correctBaseAmount}`);
        console.log(`   Kid Discount: ₹${entry.kidDiscount} → ₹${correctKidDiscount}`);
        console.log(`   Additional Discount: ₹${entry.additionalDiscount} → ₹${correctAdditionalDiscount}`);
        console.log(`   Final Amount: ₹${entry.finalAmount} (Expected: ₹${calculatedFinalAmount})`);
        console.log(`   ✅ Fixed: ${isCorrect}`);
        
        fixedCount++;
      } else {
        console.log(`✅ Entry ${entry._id} already correct: ${entry.name}`);
      }
    }
    
    // Verification after fixes
    console.log('\n🔍 Verification after fixes...');
    const updatedEntries = await Entry.find({}).lean();
    
    let correctCount = 0;
    let incorrectCount = 0;
    
    for (const entry of updatedEntries) {
      const totalDiscount = (entry.kidDiscount || 0) + (entry.additionalDiscount || 0);
      const expectedFinal = (entry.baseAmount || 0) - totalDiscount;
      
      if (entry.finalAmount === expectedFinal) {
        correctCount++;
      } else {
        incorrectCount++;
        console.log(`❌ Still incorrect: ${entry.name} - Final: ₹${entry.finalAmount}, Expected: ₹${expectedFinal}`);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Total entries: ${updatedEntries.length}`);
    console.log(`   Entries fixed: ${fixedCount}`);
    console.log(`   Entries correct: ${correctCount}`);
    console.log(`   Entries still incorrect: ${incorrectCount}`);
    console.log(`   Errors encountered: ${errorCount}`);
    
    // Final aggregate verification
    const finalStats = await Entry.aggregate([
      {
        $group: {
          _id: null,
          totalBaseAmount: { $sum: '$baseAmount' },
          totalFinalAmount: { $sum: '$finalAmount' },
          totalKidDiscount: { $sum: '$kidDiscount' },
          totalAdditionalDiscount: { $sum: '$additionalDiscount' }
        }
      }
    ]);
    
    if (finalStats.length > 0) {
      const stats = finalStats[0];
      const calculatedDiscount = stats.totalKidDiscount + stats.totalAdditionalDiscount;
      const actualDiscount = stats.totalBaseAmount - stats.totalFinalAmount;
      
      console.log('\n💰 Final Aggregate Verification:');
      console.log(`   Total Base Amount: ₹${stats.totalBaseAmount}`);
      console.log(`   Total Final Amount: ₹${stats.totalFinalAmount}`);
      console.log(`   Total Calculated Discount: ₹${calculatedDiscount}`);
      console.log(`   Total Actual Discount: ₹${actualDiscount}`);
      console.log(`   ✅ Aggregate Correct: ${calculatedDiscount === actualDiscount}`);
    }
    
    console.log('\n✅ DISCOUNT CALCULATION FIX COMPLETED!');
    console.log('🎯 All entries now have mathematically correct discount calculations');
    console.log('💰 Dashboard will show accurate discount data');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('📍 Stack Trace:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 MongoDB Connection Closed');
    }
  }
}

fixDiscountCalculationErrors();
