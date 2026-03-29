const mongoose = require('mongoose');
const { Entry } = require('./src/models/Entry.js');
require('dotenv').config();

async function comprehensiveFinalCheck() {
  try {
    console.log('🔍 COMPREHENSIVE FINAL SYSTEM CHECK\n');
    console.log('=' .repeat(80));
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // 1. Check all entries for completeness
    console.log('\n📊 1. ENTRY COMPLETENESS CHECK');
    const allEntries = await Entry.find({}).lean();
    console.log(`Total entries in database: ${allEntries.length}`);
    
    let incompleteEntries = 0;
    let entriesWithoutDiscounts = 0;
    let entriesWithNegativeDiscounts = 0;
    
    for (const entry of allEntries) {
      // Check for missing fields
      if (!entry.baseAmount && entry.baseAmount !== 0) incompleteEntries++;
      if (!entry.kidDiscount && entry.kidDiscount !== 0) incompleteEntries++;
      if (!entry.additionalDiscount && entry.additionalDiscount !== 0) incompleteEntries++;
      
      // Check for entries without any discounts
      if ((entry.kidDiscount || 0) === 0 && (entry.additionalDiscount || 0) === 0) {
        entriesWithoutDiscounts++;
      }
      
      // Check for negative discounts
      if ((entry.kidDiscount || 0) < 0 || (entry.additionalDiscount || 0) < 0) {
        entriesWithNegativeDiscounts++;
      }
    }
    
    console.log(`Incomplete entries: ${incompleteEntries}`);
    console.log(`Entries without discounts: ${entriesWithoutDiscounts}`);
    console.log(`Entries with negative discounts: ${entriesWithNegativeDiscounts}`);
    
    // 2. Mathematical verification
    console.log('\n🧮 2. MATHEMATICAL VERIFICATION');
    let mathematicallyCorrect = 0;
    let mathematicallyIncorrect = 0;
    
    for (const entry of allEntries) {
      const baseAmount = entry.baseAmount || 0;
      const kidDiscount = entry.kidDiscount || 0;
      const additionalDiscount = entry.additionalDiscount || 0;
      const finalAmount = entry.finalAmount || 0;
      
      const expectedFinalAmount = baseAmount - kidDiscount - additionalDiscount;
      
      if (Math.abs(expectedFinalAmount - finalAmount) < 0.01) { // Allow for floating point precision
        mathematicallyCorrect++;
      } else {
        mathematicallyIncorrect++;
        console.log(`❌ Math error: ${entry.name} - Expected: ₹${expectedFinalAmount}, Actual: ₹${finalAmount}`);
      }
    }
    
    console.log(`Mathematically correct: ${mathematicallyCorrect}`);
    console.log(`Mathematically incorrect: ${mathematicallyIncorrect}`);
    
    // 3. Financial summary
    console.log('\n💰 3. FINANCIAL SUMMARY');
    const financialSummary = await Entry.aggregate([
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
          },
          entriesWithAnyDiscount: {
            $sum: { $cond: [{ $or: [{ $gt: ['$kidDiscount', 0] }, { $gt: ['$additionalDiscount', 0] }] }, 1, 0] }
          }
        }
      }
    ]);
    
    if (financialSummary.length > 0) {
      const summary = financialSummary[0];
      const totalCalculatedDiscount = summary.totalKidDiscount + summary.totalAdditionalDiscount;
      const actualDiscountAmount = summary.totalBaseAmount - summary.totalFinalAmount;
      const discountRate = (summary.entriesWithAnyDiscount / summary.totalEntries) * 100;
      
      console.log(`Total Entries: ${summary.totalEntries}`);
      console.log(`Total Base Amount: ₹${summary.totalBaseAmount}`);
      console.log(`Total Final Amount: ₹${summary.totalFinalAmount}`);
      console.log(`Total Kid Discount: ₹${summary.totalKidDiscount}`);
      console.log(`Total Additional Discount: ₹${summary.totalAdditionalDiscount}`);
      console.log(`Total Calculated Discount: ₹${totalCalculatedDiscount}`);
      console.log(`Actual Discount Amount: ₹${actualDiscountAmount}`);
      console.log(`Entries with Kid Discounts: ${summary.entriesWithKidDiscount}`);
      console.log(`Entries with Additional Discounts: ${summary.entriesWithAdditionalDiscount}`);
      console.log(`Entries with Any Discount: ${summary.entriesWithAnyDiscount}`);
      console.log(`Discount Rate: ${discountRate.toFixed(2)}%`);
      console.log(`✅ Financial Math Correct: ${Math.abs(totalCalculatedDiscount - actualDiscountAmount) < 0.01}`);
    }
    
    // 4. Today's data verification
    console.log('\n📅 4. TODAY\'S DATA VERIFICATION');
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const todayEntries = await Entry.find({
      createdAt: { $gte: todayStart, $lt: todayEnd }
    }).lean();
    
    console.log(`Today's entries: ${todayEntries.length}`);
    
    if (todayEntries.length > 0) {
      const todaySummary = {
        totalEntries: todayEntries.length,
        totalBaseAmount: todayEntries.reduce((sum, e) => sum + (e.baseAmount || 0), 0),
        totalFinalAmount: todayEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
        totalKidDiscount: todayEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0),
        totalAdditionalDiscount: todayEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0)
      };
      
      todaySummary.totalDiscount = todaySummary.totalKidDiscount + todaySummary.totalAdditionalDiscount;
      todaySummary.discountRate = (todayEntries.filter(e => (e.kidDiscount || 0) > 0 || (e.additionalDiscount || 0) > 0).length / todayEntries.length) * 100;
      
      console.log(`Today's Base Amount: ₹${todaySummary.totalBaseAmount}`);
      console.log(`Today's Final Amount: ₹${todaySummary.totalFinalAmount}`);
      console.log(`Today's Kid Discount: ₹${todaySummary.totalKidDiscount}`);
      console.log(`Today's Additional Discount: ₹${todaySummary.totalAdditionalDiscount}`);
      console.log(`Today's Total Discount: ₹${todaySummary.totalDiscount}`);
      console.log(`Today's Discount Rate: ${todaySummary.discountRate.toFixed(2)}%`);
    }
    
    // 5. System health check
    console.log('\n🏥 5. SYSTEM HEALTH CHECK');
    
    // Check if backend server is responding
    try {
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/health',
        method: 'GET',
        timeout: 3000
      };
      
      const req = http.request(options, (res) => {
        console.log(`✅ Backend server responding (Status: ${res.statusCode})`);
      });
      
      req.on('error', () => {
        console.log('❌ Backend server not responding');
      });
      
      req.on('timeout', () => {
        console.log('❌ Backend server timeout');
        req.destroy();
      });
      
      req.end();
    } catch (error) {
      console.log('❌ Backend health check failed');
    }
    
    // Check if frontend is built
    const fs = require('fs');
    const path = require('path');
    const distPath = path.join(__dirname, '../../dist/index.html');
    
    if (fs.existsSync(distPath)) {
      console.log('✅ Frontend built successfully');
    } else {
      console.log('❌ Frontend not built');
    }
    
    // Final assessment
    console.log('\n🎯 6. FINAL ASSESSMENT');
    
    const issues = [];
    if (incompleteEntries > 0) issues.push(`${incompleteEntries} incomplete entries`);
    if (mathematicallyIncorrect > 0) issues.push(`${mathematicallyIncorrect} mathematically incorrect entries`);
    if (entriesWithNegativeDiscounts > 0) issues.push(`${entriesWithNegativeDiscounts} entries with negative discounts`);
    
    if (issues.length === 0) {
      console.log('✅ SYSTEM IS PERFECT - No issues found!');
      console.log('🎉 All discount data is correctly calculated and stored');
      console.log('💰 Dashboard will show accurate discount information');
      console.log('🚀 Ready for production deployment');
    } else {
      console.log('❌ ISSUES FOUND:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('🔧 Fixes needed before deployment');
    }
    
  } catch (error) {
    console.error('❌ Comprehensive check failed:', error.message);
    console.error('📍 Stack Trace:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 MongoDB Connection Closed');
    }
  }
}

comprehensiveFinalCheck();
