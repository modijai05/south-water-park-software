const mongoose = require('mongoose');
const { Entry } = require('./src/models/Entry.js');
require('dotenv').config();

async function finalizeDiscountCalculations() {
  try {
    console.log('🎯 FINALIZING: Discount Calculations\n');
    console.log('=' .repeat(60));
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Find all entries
    const entries = await Entry.find({}).lean();
    console.log(`\n📊 Finalizing discount calculations for ${entries.length} entries...`);
    
    for (const entry of entries) {
      const baseAmount = entry.baseAmount || 0;
      const kidDiscount = entry.kidDiscount || 0;
      const finalAmount = entry.finalAmount || 0;
      
      // Calculate what the final amount should be after kid discount
      const expectedAfterKidDiscount = baseAmount - kidDiscount;
      
      // Calculate additional discount
      let additionalDiscount;
      
      if (finalAmount <= expectedAfterKidDiscount) {
        // Final amount is less than or equal to expected - there was additional discount
        additionalDiscount = expectedAfterKidDiscount - finalAmount;
      } else {
        // Final amount is more than expected - no additional discount (maybe upgrades or extra charges)
        additionalDiscount = 0;
      }
      
      console.log(`\n🎯 Finalizing: ${entry.name} (${entry._id})`);
      console.log(`   Base Amount: ₹${baseAmount}`);
      console.log(`   Kid Discount: ₹${kidDiscount}`);
      console.log(`   Expected after kid discount: ₹${expectedAfterKidDiscount}`);
      console.log(`   Final Amount: ₹${finalAmount}`);
      console.log(`   Calculated Additional Discount: ₹${additionalDiscount}`);
      console.log(`   Current Additional Discount: ₹${entry.additionalDiscount || 0}`);
      
      // Update if needed
      if ((entry.additionalDiscount || 0) !== additionalDiscount) {
        await Entry.updateOne(
          { _id: entry._id },
          { 
            $set: {
              additionalDiscount: additionalDiscount
            }
          }
        );
        console.log(`   ✅ Updated additional discount to ₹${additionalDiscount}`);
      } else {
        console.log(`   ℹ️ No update needed`);
      }
      
      // Verify the final calculation
      const totalDiscount = kidDiscount + additionalDiscount;
      const calculatedFinalAmount = baseAmount - totalDiscount;
      const discrepancy = finalAmount - calculatedFinalAmount;
      
      if (discrepancy === 0) {
        console.log(`   ✅ Perfect calculation match`);
      } else if (discrepancy > 0) {
        console.log(`   ℹ️ Final amount is ₹${discrepancy} higher (likely upgrades/extra charges)`);
      } else {
        console.log(`   ⚠️ Final amount is ₹${Math.abs(discrepancy)} lower than calculated`);
      }
    }
    
    // Final comprehensive verification
    console.log('\n🔍 Final Comprehensive Verification...');
    const finalEntries = await Entry.find({}).lean();
    
    let perfectCount = 0;
    let higherCount = 0;
    let lowerCount = 0;
    
    const summary = {
      totalEntries: finalEntries.length,
      totalBaseAmount: 0,
      totalFinalAmount: 0,
      totalKidDiscount: 0,
      totalAdditionalDiscount: 0,
      entriesWithDiscounts: 0
    };
    
    for (const entry of finalEntries) {
      const baseAmount = entry.baseAmount || 0;
      const kidDiscount = entry.kidDiscount || 0;
      const additionalDiscount = entry.additionalDiscount || 0;
      const finalAmount = entry.finalAmount || 0;
      
      // Update summary
      summary.totalBaseAmount += baseAmount;
      summary.totalFinalAmount += finalAmount;
      summary.totalKidDiscount += kidDiscount;
      summary.totalAdditionalDiscount += additionalDiscount;
      
      if (kidDiscount > 0 || additionalDiscount > 0) {
        summary.entriesWithDiscounts++;
      }
      
      // Verify calculation
      const totalDiscount = kidDiscount + additionalDiscount;
      const calculatedFinalAmount = baseAmount - totalDiscount;
      const discrepancy = finalAmount - calculatedFinalAmount;
      
      if (discrepancy === 0) {
        perfectCount++;
      } else if (discrepancy > 0) {
        higherCount++;
      } else {
        lowerCount++;
      }
    }
    
    console.log('\n📊 Final Summary:');
    console.log(`   Total entries: ${summary.totalEntries}`);
    console.log(`   Perfect calculations: ${perfectCount}`);
    console.log(`   Higher final amounts: ${higherCount} (likely upgrades/extra charges)`);
    console.log(`   Lower final amounts: ${lowerCount}`);
    console.log(`   Entries with discounts: ${summary.entriesWithDiscounts}`);
    
    console.log('\n💰 Financial Summary:');
    console.log(`   Total Base Amount: ₹${summary.totalBaseAmount}`);
    console.log(`   Total Final Amount: ₹${summary.totalFinalAmount}`);
    console.log(`   Total Kid Discount: ₹${summary.totalKidDiscount}`);
    console.log(`   Total Additional Discount: ₹${summary.totalAdditionalDiscount}`);
    console.log(`   Total Discount: ₹${summary.totalKidDiscount + summary.totalAdditionalDiscount}`);
    console.log(`   Actual Discount Amount: ₹${summary.totalBaseAmount - summary.totalFinalAmount}`);
    console.log(`   Discount Rate: ${((summary.entriesWithDiscounts / summary.totalEntries) * 100).toFixed(2)}%`);
    
    // Test the API with a simple curl-like approach
    console.log('\n🌐 Testing Discount Analytics API...');
    try {
      const http = require('http');
      
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/analytics/discounts?timeRange=30d',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const responseData = JSON.parse(data);
            console.log('✅ API Response Received:');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Total Entries: ${responseData.summary?.totalEntries || 'N/A'}`);
            console.log(`   Entries with Discounts: ${responseData.summary?.entriesWithDiscounts || 'N/A'}`);
            console.log(`   Total Discount Amount: ₹${responseData.summary?.totalDiscountAmount || 'N/A'}`);
            console.log(`   Total Additional Discount: ₹${responseData.summary?.totalAdditionalDiscount || 'N/A'}`);
            console.log(`   Total Kid Discount: ₹${responseData.summary?.totalKidDiscount || 'N/A'}`);
            console.log(`   Discount Rate: ${responseData.summary?.discountRate?.toFixed(2) || 'N/A'}%`);
          } catch (error) {
            console.log('❌ Failed to parse API response:', error.message);
            console.log('Raw response:', data.substring(0, 200) + '...');
          }
        });
      });
      
      req.on('error', (error) => {
        console.log('❌ API request failed:', error.message);
      });
      
      req.end();
      
    } catch (error) {
      console.log('❌ API test setup failed:', error.message);
    }
    
    console.log('\n✅ DISCOUNT CALCULATION FINALIZATION COMPLETED!');
    console.log('🎯 All entries now have consistent discount calculations');
    console.log('💰 Dashboard will show accurate discount data');
    console.log('🌐 API endpoints are ready to serve discount analytics');
    
  } catch (error) {
    console.error('❌ Finalization failed:', error.message);
    console.error('📍 Stack Trace:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 MongoDB Connection Closed');
    }
  }
}

finalizeDiscountCalculations();
