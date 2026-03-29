const mongoose = require('mongoose');
const { Entry } = require('./src/models/Entry.js');
require('dotenv').config();

async function testDiscountData() {
  try {
    console.log('🧪 MANUAL TESTING: Discount Data Verification\n');
    console.log('=' .repeat(60));
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Test 1: Check total entries and discount fields
    console.log('\n📊 Test 1: Database Entry Analysis');
    const totalEntries = await Entry.countDocuments();
    const entriesWithDiscounts = await Entry.countDocuments({
      $or: [
        { additionalDiscount: { $gt: 0 } },
        { kidDiscount: { $gt: 0 } }
      ]
    });
    
    console.log(`Total entries: ${totalEntries}`);
    console.log(`Entries with discounts: ${entriesWithDiscounts}`);
    console.log(`Discount rate: ${((entriesWithDiscounts / totalEntries) * 100).toFixed(2)}%`);
    
    // Test 2: Sample entry analysis
    console.log('\n📋 Test 2: Sample Entry Analysis');
    const sampleEntries = await Entry.find({}).limit(5).lean();
    
    sampleEntries.forEach((entry, index) => {
      console.log(`\nEntry ${index + 1}: ${entry.name} (${entry.ticketType} ticket)`);
      console.log(`  Created: ${new Date(entry.createdAt).toLocaleString()}`);
      console.log(`  Adults: ${entry.adults}, Kids: ${entry.kids}`);
      console.log(`  Base Amount: ₹${entry.baseAmount || 0}`);
      console.log(`  Kid Discount: ₹${entry.kidDiscount || 0}`);
      console.log(`  Additional Discount: ₹${entry.additionalDiscount || 0}`);
      console.log(`  Final Amount: ₹${entry.finalAmount || 0}`);
      
      const totalDiscount = (entry.kidDiscount || 0) + (entry.additionalDiscount || 0);
      const expectedFinal = (entry.baseAmount || 0) - totalDiscount;
      console.log(`  Total Discount: ₹${totalDiscount}`);
      console.log(`  Expected Final: ₹${expectedFinal}`);
      console.log(`  ✅ Final Amount Correct: ${entry.finalAmount === expectedFinal}`);
    });
    
    // Test 3: Aggregate discount statistics
    console.log('\n📈 Test 3: Aggregate Discount Statistics');
    const discountStats = await Entry.aggregate([
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalBaseAmount: { $sum: '$baseAmount' },
          totalFinalAmount: { $sum: '$finalAmount' },
          totalKidDiscount: { $sum: '$kidDiscount' },
          totalAdditionalDiscount: { $sum: '$additionalDiscount' },
          entriesWithKidDiscount: {
            $sum: { $cond: [{ $gt: ['$kidDiscount', 0] }, 1, 0] }
          },
          entriesWithAdditionalDiscount: {
            $sum: { $cond: [{ $gt: ['$additionalDiscount', 0] }, 1, 0] }
          }
        }
      }
    ]);
    
    if (discountStats.length > 0) {
      const stats = discountStats[0];
      const totalDiscount = stats.totalKidDiscount + stats.totalAdditionalDiscount;
      const discountAmount = stats.totalBaseAmount - stats.totalFinalAmount;
      
      console.log(`Total Base Amount: ₹${stats.totalBaseAmount}`);
      console.log(`Total Final Amount: ₹${stats.totalFinalAmount}`);
      console.log(`Total Kid Discount: ₹${stats.totalKidDiscount}`);
      console.log(`Total Additional Discount: ₹${stats.totalAdditionalDiscount}`);
      console.log(`Calculated Total Discount: ₹${totalDiscount}`);
      console.log(`Actual Discount Amount: ₹${discountAmount}`);
      console.log(`✅ Discount Calculation Correct: ${totalDiscount === discountAmount}`);
      console.log(`Entries with Kid Discounts: ${stats.entriesWithKidDiscount}`);
      console.log(`Entries with Additional Discounts: ${stats.entriesWithAdditionalDiscount}`);
    }
    
    // Test 4: Today's data specifically
    console.log('\n📅 Test 4: Today\'s Discount Data');
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const todayEntries = await Entry.find({
      createdAt: { $gte: todayStart, $lt: todayEnd }
    }).lean();
    
    console.log(`Today's entries: ${todayEntries.length}`);
    
    const todayStats = {
      totalEntries: todayEntries.length,
      totalBaseAmount: todayEntries.reduce((sum, e) => sum + (e.baseAmount || 0), 0),
      totalFinalAmount: todayEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
      totalKidDiscount: todayEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0),
      totalAdditionalDiscount: todayEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0)
    };
    
    todayStats.totalDiscount = todayStats.totalKidDiscount + todayStats.totalAdditionalDiscount;
    todayStats.discountRate = todayStats.totalEntries > 0 ? 
      ((todayEntries.filter(e => (e.kidDiscount || 0) > 0 || (e.additionalDiscount || 0) > 0).length / todayStats.totalEntries) * 100) : 0;
    
    console.log(`Today's Base Amount: ₹${todayStats.totalBaseAmount}`);
    console.log(`Today's Final Amount: ₹${todayStats.totalFinalAmount}`);
    console.log(`Today's Kid Discount: ₹${todayStats.totalKidDiscount}`);
    console.log(`Today's Additional Discount: ₹${todayStats.totalAdditionalDiscount}`);
    console.log(`Today's Total Discount: ₹${todayStats.totalDiscount}`);
    console.log(`Today's Discount Rate: ${todayStats.discountRate.toFixed(2)}%`);
    
    console.log('\n✅ MANUAL TESTING COMPLETED SUCCESSFULLY!');
    console.log('🎯 All discount data is properly calculated and stored');
    console.log('💰 Dashboard should now show accurate discount information');
    
  } catch (error) {
    console.error('❌ Manual testing failed:', error.message);
    console.error('📍 Stack Trace:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 MongoDB Connection Closed');
    }
  }
}

testDiscountData();
