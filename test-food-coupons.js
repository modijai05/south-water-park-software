const mongoose = require('mongoose');
const { Entry } = require('./backend/server/src/models/Entry.js');

async function testFoodCoupons() {
  try {
    await mongoose.connect('mongodb://localhost:27017/south-water-park');
    console.log('Connected to MongoDB');
    
    // Check for entries with food coupon data
    const entriesWithCoupons = await Entry.find({
      $or: [
        { adultsFastFoodCoupon: { $exists: true, $gt: 0 } },
        { kidsFastFoodCoupon: { $exists: true, $gt: 0 } },
        { adultsMainFoodCoupon: { $exists: true, $gt: 0 } },
        { kidsMainFoodCoupon: { $exists: true, $gt: 0 } }
      ]
    }).limit(5);
    
    console.log('Entries with food coupons:', entriesWithCoupons.length);
    if (entriesWithCoupons.length > 0) {
      console.log('Sample entry:', JSON.stringify(entriesWithCoupons[0], null, 2));
    } else {
      console.log('No entries found with food coupons. Creating a test entry...');
      
      // Create a test entry with food coupons
      const testEntry = new Entry({
        name: 'Test Customer',
        mobile: '1234567890',
        ticketType: '300',
        adults: 2,
        kids: 1,
        totalPeople: 3,
        finalAmount: 900,
        cashAmount: 900,
        adultsFastFoodCoupon: 2,
        kidsFastFoodCoupon: 1,
        adultsMainFoodCoupon: 2,
        kidsMainFoodCoupon: 1,
        filledBy: 'test',
        filledByFullName: 'Test User',
        createdAt: new Date()
      });
      
      await testEntry.save();
      console.log('Test entry created with food coupons:', testEntry._id);
    }
    
    // Test the stats calculation
    const stats = await calculateStats();
    console.log('Food coupons stats:', {
      todayAdultsFastFoodCoupons: stats.todayAdultsFastFoodCoupons,
      todayKidsFastFoodCoupons: stats.todayKidsFastFoodCoupons,
      todayAdultsMainFoodCoupons: stats.todayAdultsMainFoodCoupons,
      todayKidsMainFoodCoupons: stats.todayKidsMainFoodCoupons,
      todayTotalFoodCoupons: stats.todayTotalFoodCoupons
    });
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Copy the stats calculation function from entries.js
async function calculateStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const stats = {
    todayAdultsFastFoodCoupons: 0,
    todayKidsFastFoodCoupons: 0,
    todayAdultsMainFoodCoupons: 0,
    todayKidsMainFoodCoupons: 0,
    todayTotalFastFoodCoupons: 0,
    todayTotalMainFoodCoupons: 0,
    todayTotalFoodCoupons: 0,
  };
  
  const todayEntries = await Entry.find({
    createdAt: { $gte: today, $lt: tomorrow }
  });
  
  todayEntries.forEach(entry => {
    const adultsFastFoodCoupon = entry.adultsFastFoodCoupon || 0;
    const kidsFastFoodCoupon = entry.kidsFastFoodCoupon || 0;
    const adultsMainFoodCoupon = entry.adultsMainFoodCoupon || 0;
    const kidsMainFoodCoupon = entry.kidsMainFoodCoupon || 0;
    
    const adultCoupons = adultsFastFoodCoupon + adultsMainFoodCoupon;
    const kidCoupons = kidsFastFoodCoupon + kidsMainFoodCoupon;
    
    stats.todayAdultsFastFoodCoupons += adultsFastFoodCoupon;
    stats.todayKidsFastFoodCoupons += kidsFastFoodCoupon;
    stats.todayAdultsMainFoodCoupons += adultsMainFoodCoupon;
    stats.todayKidsMainFoodCoupons += kidsMainFoodCoupon;
    stats.todayTotalFastFoodCoupons += adultsFastFoodCoupon + kidsFastFoodCoupon;
    stats.todayTotalMainFoodCoupons += adultsMainFoodCoupon + kidsMainFoodCoupon;
    stats.todayTotalFoodCoupons += adultCoupons + kidCoupons;
  });
  
  return stats;
}

testFoodCoupons();
