// Create Test Entries with Discount Data
require('dotenv').config();
const mongoose = require('mongoose');
const { Entry } = require('./src/models/Entry.js');
const dayjs = require('dayjs');

async function createDiscountEntries() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/south-water-park');
    console.log('✅ Connected to MongoDB');

    // Clear existing test entries
    await Entry.deleteMany({ username: /Test Discount User/ });

    const discountEntries = [
      {
        name: 'Test Discount User 1',
        mobile: '9999999991',
        username: 'Test Discount User 1',
        ticketType: '300',
        adults: 2,
        kids: 1,
        totalPeople: 3,
        baseAmount: 900,
        kidDiscount: 50,
        additionalDiscount: 100,
        finalAmount: 750,
        cashAmount: 750,
        upiAmount: 0,
        createdAt: dayjs().subtract(1, 'day').toDate()
      },
      {
        name: 'Test Discount User 2',
        mobile: '9999999992',
        username: 'Test Discount User 2',
        ticketType: '600',
        adults: 4,
        kids: 2,
        totalPeople: 6,
        baseAmount: 2400,
        kidDiscount: 200,
        additionalDiscount: 150,
        finalAmount: 2050,
        cashAmount: 0,
        upiAmount: 2050,
        createdAt: dayjs().subtract(2, 'day').toDate()
      },
      {
        name: 'Test Discount User 3',
        mobile: '9999999993',
        username: 'Test Discount User 3',
        ticketType: '150',
        adults: 1,
        kids: 0,
        totalPeople: 1,
        baseAmount: 150,
        kidDiscount: 0,
        additionalDiscount: 25,
        finalAmount: 125,
        cashAmount: 125,
        upiAmount: 0,
        createdAt: dayjs().subtract(3, 'day').toDate()
      },
      {
        name: 'Test Discount User 4',
        mobile: '9999999994',
        username: 'Test Discount User 4',
        ticketType: '450',
        adults: 2,
        kids: 2,
        totalPeople: 4,
        baseAmount: 1800,
        kidDiscount: 100,
        additionalDiscount: 200,
        finalAmount: 1500,
        cashAmount: 0,
        upiAmount: 1500,
        createdAt: dayjs().subtract(5, 'day').toDate()
      },
      {
        name: 'Test Discount User 5',
        mobile: '9999999995',
        username: 'Test Discount User 5',
        ticketType: '300',
        adults: 3,
        kids: 1,
        totalPeople: 4,
        baseAmount: 900,
        kidDiscount: 0,
        additionalDiscount: 75,
        finalAmount: 825,
        cashAmount: 825,
        upiAmount: 0,
        createdAt: dayjs().subtract(10, 'day').toDate()
      }
    ];

    // Insert the test entries
    const insertedEntries = await Entry.insertMany(discountEntries);
    
    console.log(`✅ Created ${insertedEntries.length} test entries with discount data:`);
    
    let totalAdditionalDiscount = 0;
    let totalKidDiscount = 0;
    
    insertedEntries.forEach((entry, index) => {
      const additional = entry.additionalDiscount || 0;
      const kid = entry.kidDiscount || 0;
      const total = additional + kid;
      
      totalAdditionalDiscount += additional;
      totalKidDiscount += kid;
      
      console.log(`\n${index + 1}. ${entry.username}`);
      console.log(`   🎫 Ticket Type: ${entry.ticketType}`);
      console.log(`   👥 People: ${entry.totalPeople} (${entry.adults} adults, ${entry.kids} kids)`);
      console.log(`   💰 Base Amount: ₹${entry.baseAmount}`);
      console.log(`   🎁 Additional Discount: ₹${additional}`);
      console.log(`   👶 Kid Discount: ₹${kid}`);
      console.log(`   💵 Total Discount: ₹${total}`);
      console.log(`   🎯 Final Amount: ₹${entry.finalAmount}`);
      console.log(`   💳 Payment: ${entry.cashAmount > 0 ? 'Cash' : 'UPI'}`);
      console.log(`   📅 Created: ${dayjs(entry.createdAt).format('YYYY-MM-DD HH:mm')}`);
    });
    
    console.log(`\n📈 Summary:`);
    console.log(`   Total Additional Discounts: ₹${totalAdditionalDiscount}`);
    console.log(`   Total Kid Discounts: ₹${totalKidDiscount}`);
    console.log(`   Total All Discounts: ₹${totalAdditionalDiscount + totalKidDiscount}`);
    console.log(`   Average Discount per Entry: ₹${Math.round((totalAdditionalDiscount + totalKidDiscount) / insertedEntries.length)}`);

  } catch (error) {
    console.error('❌ Error creating discount entries:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createDiscountEntries();
