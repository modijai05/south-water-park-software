// Check Discount Data in Database
require('dotenv').config();
const mongoose = require('mongoose');
const { Entry } = require('./src/models/Entry.js');

async function checkDiscountData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/south-water-park');
    console.log('✅ Connected to MongoDB');

    // Get all entries with discount data
    const entriesWithDiscount = await Entry.find({
      $or: [
        { additionalDiscount: { $gt: 0 } },
        { kidDiscount: { $gt: 0 } }
      ]
    }).sort({ createdAt: -1 }).limit(10);

    console.log(`\n📊 Found ${entriesWithDiscount.length} entries with discount data:`);

    let totalAdditionalDiscount = 0;
    let totalKidDiscount = 0;

    entriesWithDiscount.forEach((entry, index) => {
      const additional = entry.additionalDiscount || 0;
      const kid = entry.kidDiscount || 0;
      const total = additional + kid;

      totalAdditionalDiscount += additional;
      totalKidDiscount += kid;

      console.log(`\n${index + 1}. ${entry.username || 'Unknown'} - ${entry.ticketType}`);
      console.log(`   📅 Created: ${entry.createdAt}`);
      console.log(`   💰 Additional Discount: ₹${additional}`);
      console.log(`   👶 Kid Discount: ₹${kid}`);
      console.log(`   💵 Total Discount: ₹${total}`);
      console.log(`   🎫 Final Amount: ₹${entry.finalAmount}`);
    });

    // Get overall stats
    const allEntries = await Entry.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEntries = await Entry.find({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    const todayAdditionalDiscount = todayEntries.reduce((sum, entry) => sum + (entry.additionalDiscount || 0), 0);
    const todayKidDiscount = todayEntries.reduce((sum, entry) => sum + (entry.kidDiscount || 0), 0);

    console.log(`\n📈 Discount Summary:`);
    console.log(`   Total Entries: ${allEntries}`);
    console.log(`   Today's Entries: ${todayEntries.length}`);
    console.log(`   Entries with Discounts: ${entriesWithDiscount.length}`);
    console.log(`   Today's Additional Discount: ₹${todayAdditionalDiscount}`);
    console.log(`   Today's Kid Discount: ₹${todayKidDiscount}`);
    console.log(`   Today's Total Discount: ₹${todayAdditionalDiscount + todayKidDiscount}`);
    console.log(`   All-Time Additional Discount: ₹${totalAdditionalDiscount}`);
    console.log(`   All-Time Kid Discount: ₹${totalKidDiscount}`);
    console.log(`   All-Time Total Discount: ₹${totalAdditionalDiscount + totalKidDiscount}`);

  } catch (error) {
    console.error('❌ Error checking discount data:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkDiscountData();
