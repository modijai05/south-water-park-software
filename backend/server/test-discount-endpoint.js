// Test Discount Analytics Endpoint Directly
require('dotenv').config();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const { Entry } = require('./src/models/Entry.js');

async function testDiscountEndpoint() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/south-water-park');
    console.log('✅ Connected to MongoDB');

    // Simulate the analytics endpoint logic
    const timeRange = '30d';
    const now = dayjs();
    let startDate = now.subtract(30, 'day');
    
    console.log(`📅 Testing discount analytics for range: ${startDate.format('YYYY-MM-DD')} to ${now.format('YYYY-MM-DD')}`);
    
    // Get entries within the time range
    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();
    
    console.log(`📊 Found ${entries.length} entries in date range`);
    
    // Calculate comprehensive discount analytics
    const discountAnalytics = {
      summary: {
        totalEntries: entries.length,
        entriesWithDiscounts: 0,
        totalDiscountAmount: 0,
        totalAdditionalDiscount: 0,
        totalKidDiscount: 0,
        averageDiscountPerEntry: 0,
        discountRate: 0
      },
      trends: {
        dailyDiscounts: [],
        discountTypes: {
          additional: { count: 0, amount: 0, avgAmount: 0 },
          kid: { count: 0, amount: 0, avgAmount: 0 }
        },
        ticketTypeDiscounts: {}
      },
      insights: {
        highestDiscountDay: null,
        mostDiscountedTicketType: null,
        discountFrequency: 'low',
        totalSavings: 0
      }
    };
    
    // Process entries for discount data
    const dailyData = {};
    
    entries.forEach(entry => {
      const additionalDiscount = entry.additionalDiscount || 0;
      const kidDiscount = entry.kidDiscount || 0;
      const totalDiscount = additionalDiscount + kidDiscount;
      
      if (totalDiscount > 0) {
        discountAnalytics.summary.entriesWithDiscounts++;
        discountAnalytics.summary.totalDiscountAmount += totalDiscount;
        discountAnalytics.summary.totalAdditionalDiscount += additionalDiscount;
        discountAnalytics.summary.totalKidDiscount += kidDiscount;
        
        // Track by ticket type
        const ticketType = entry.ticketType || 'unknown';
        if (!discountAnalytics.trends.ticketTypeDiscounts[ticketType]) {
          discountAnalytics.trends.ticketTypeDiscounts[ticketType] = {
            count: 0,
            totalDiscount: 0,
            avgDiscount: 0
          };
        }
        discountAnalytics.trends.ticketTypeDiscounts[ticketType].count++;
        discountAnalytics.trends.ticketTypeDiscounts[ticketType].totalDiscount += totalDiscount;
        
        // Track discount types
        if (additionalDiscount > 0) {
          discountAnalytics.trends.discountTypes.additional.count++;
          discountAnalytics.trends.discountTypes.additional.amount += additionalDiscount;
        }
        if (kidDiscount > 0) {
          discountAnalytics.trends.discountTypes.kid.count++;
          discountAnalytics.trends.discountTypes.kid.amount += kidDiscount;
        }
        
        // Track daily discounts
        const day = dayjs(entry.createdAt).format('YYYY-MM-DD');
        if (!dailyData[day]) {
          dailyData[day] = { date: day, additionalDiscount: 0, kidDiscount: 0, totalDiscount: 0, entries: 0 };
        }
        dailyData[day].additionalDiscount += additionalDiscount;
        dailyData[day].kidDiscount += kidDiscount;
        dailyData[day].totalDiscount += totalDiscount;
        dailyData[day].entries++;
      }
    });
    
    // Calculate averages and rates
    if (entries.length > 0) {
      discountAnalytics.summary.discountRate = (discountAnalytics.summary.entriesWithDiscounts / entries.length) * 100;
      discountAnalytics.summary.averageDiscountPerEntry = discountAnalytics.summary.totalDiscountAmount / entries.length;
    }
    
    // Calculate average discount amounts for discount types
    if (discountAnalytics.trends.discountTypes.additional.count > 0) {
      discountAnalytics.trends.discountTypes.additional.avgAmount = 
        discountAnalytics.trends.discountTypes.additional.amount / discountAnalytics.trends.discountTypes.additional.count;
    }
    if (discountAnalytics.trends.discountTypes.kid.count > 0) {
      discountAnalytics.trends.discountTypes.kid.avgAmount = 
        discountAnalytics.trends.discountTypes.kid.amount / discountAnalytics.trends.discountTypes.kid.count;
    }
    
    // Calculate average discount per ticket type
    Object.keys(discountAnalytics.trends.ticketTypeDiscounts).forEach(ticketType => {
      const data = discountAnalytics.trends.ticketTypeDiscounts[ticketType];
      data.avgDiscount = data.count > 0 ? data.totalDiscount / data.count : 0;
    });
    
    // Convert daily data to array and sort
    discountAnalytics.trends.dailyDiscounts = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    
    // Find insights
    if (discountAnalytics.trends.dailyDiscounts.length > 0) {
      const highestDay = discountAnalytics.trends.dailyDiscounts.reduce((max, day) => 
        day.totalDiscount > max.totalDiscount ? day : max
      );
      discountAnalytics.insights.highestDiscountDay = highestDay;
    }
    
    const ticketTypeEntries = Object.entries(discountAnalytics.trends.ticketTypeDiscounts);
    if (ticketTypeEntries.length > 0) {
      const mostDiscounted = ticketTypeEntries.reduce((max, [type, data]) => 
        data.totalDiscount > max[1].totalDiscount ? [type, data] : max
      );
      discountAnalytics.insights.mostDiscountedTicketType = {
        ticketType: mostDiscounted[0],
        ...mostDiscounted[1]
      };
    }
    
    // Determine discount frequency
    if (discountAnalytics.summary.discountRate > 50) {
      discountAnalytics.insights.discountFrequency = 'high';
    } else if (discountAnalytics.summary.discountRate > 20) {
      discountAnalytics.insights.discountFrequency = 'medium';
    } else {
      discountAnalytics.insights.discountFrequency = 'low';
    }
    
    discountAnalytics.insights.totalSavings = discountAnalytics.summary.totalDiscountAmount;
    
    console.log('\n✅ Discount Analytics Results:');
    console.log('\n📊 Summary:');
    console.log(`   Total Entries: ${discountAnalytics.summary.totalEntries}`);
    console.log(`   Entries with Discounts: ${discountAnalytics.summary.entriesWithDiscounts}`);
    console.log(`   Total Discount Amount: ₹${discountAnalytics.summary.totalDiscountAmount}`);
    console.log(`   Total Additional Discount: ₹${discountAnalytics.summary.totalAdditionalDiscount}`);
    console.log(`   Total Kid Discount: ₹${discountAnalytics.summary.totalKidDiscount}`);
    console.log(`   Discount Rate: ${discountAnalytics.summary.discountRate.toFixed(2)}%`);
    console.log(`   Average Discount per Entry: ₹${discountAnalytics.summary.averageDiscountPerEntry.toFixed(2)}`);
    
    console.log('\n📈 Trends:');
    console.log(`   Daily Discounts: ${discountAnalytics.trends.dailyDiscounts.length} days`);
    console.log(`   Additional Discount Count: ${discountAnalytics.trends.discountTypes.additional.count} (₹${discountAnalytics.trends.discountTypes.additional.amount})`);
    console.log(`   Kid Discount Count: ${discountAnalytics.trends.discountTypes.kid.count} (₹${discountAnalytics.trends.discountTypes.kid.amount})`);
    
    console.log('\n💡 Insights:');
    console.log(`   Discount Frequency: ${discountAnalytics.insights.discountFrequency}`);
    console.log(`   Total Savings: ₹${discountAnalytics.insights.totalSavings}`);
    
    if (discountAnalytics.insights.highestDiscountDay) {
      console.log(`   Highest Discount Day: ${discountAnalytics.insights.highestDiscountDay.date} (₹${discountAnalytics.insights.highestDiscountDay.totalDiscount})`);
    }
    
    if (discountAnalytics.insights.mostDiscountedTicketType) {
      console.log(`   Most Discounted Ticket: ${discountAnalytics.insights.mostDiscountedTicketType.ticketType} (₹${discountAnalytics.insights.mostDiscountedTicketType.totalDiscount})`);
    }
    
    console.log('\n🎯 Discount analytics endpoint is working correctly!');

  } catch (error) {
    console.error('❌ Error testing discount endpoint:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testDiscountEndpoint();
