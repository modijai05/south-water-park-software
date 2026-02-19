const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dayjs = require('dayjs');

// Simple Entry schema for demo
const EntrySchema = new mongoose.Schema({
  name: String,
  mobile: String,
  ticketType: String,
  adults: Number,
  kids: Number,
  totalPeople: Number,
  finalAmount: Number,
  createdAt: { type: Date, default: Date.now },
  upgrades: [{
    ticketType: String,
    adults: Number,
    kids: Number
  }]
});

const Entry = mongoose.model('Entry', EntrySchema);

const app = express();
app.use(cors());
app.use(express.json());

// Sample data generator
function generateSampleData() {
  const ticketTypes = ['150', '300', '450', '600', '100'];
  const sampleEntries = [];
  
  // Generate sample entries for the last 30 days
  for (let i = 0; i < 200; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const ticketType = ticketTypes[Math.floor(Math.random() * ticketTypes.length)];
    const adults = Math.floor(Math.random() * 5) + 1;
    const kids = Math.floor(Math.random() * 3);
    const totalPeople = ticketType === '150' ? adults : adults + kids;
    
    let finalAmount = parseInt(ticketType) * totalPeople;
    
    // Add some upgrades
    const upgrades = [];
    if (Math.random() > 0.7 && ticketType !== '600') {
      const higherTypes = ticketTypes.filter(t => parseInt(t) > parseInt(ticketType));
      if (higherTypes.length > 0) {
        const upgradeType = higherTypes[Math.floor(Math.random() * higherTypes.length)];
        upgrades.push({
          ticketType: upgradeType,
          adults: Math.floor(Math.random() * adults) + 1,
          kids: Math.floor(Math.random() * kids)
        });
        finalAmount += parseInt(upgradeType) * (upgrades[0].adults + upgrades[0].kids);
      }
    }
    
    sampleEntries.push({
      name: `Customer ${i + 1}`,
      mobile: `987654321${i % 10}`,
      ticketType,
      adults,
      kids,
      totalPeople,
      finalAmount,
      createdAt: dayjs().subtract(daysAgo, 'day').toDate(),
      upgrades
    });
  }
  
  return sampleEntries;
}

// Ticket demand analysis endpoint
app.get('/api/ticket-demand-analysis/analysis', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = dayjs().subtract(days, 'day').startOf('day').toDate();
    
    // Get entries from database or generate sample data
    let entries = await Entry.find({ createdAt: { $gte: startDate } }).lean();
    
    // If no real data, generate sample data
    if (entries.length === 0) {
      const sampleData = generateSampleData();
      await Entry.insertMany(sampleData);
      entries = await Entry.find({ createdAt: { $gte: startDate } }).lean();
    }
    
    // Ticket type definitions
    const ticketDefinitions = {
      '150': { name: 'Without Food 1hr', price: 150 },
      '300': { name: 'Without Food 3-4hr', price: 300 },
      '450': { name: 'With Fast Food', price: 450 },
      '600': { name: 'With Main Food', price: 600 },
      '100': { name: 'Sitting Only', price: 100 }
    };
    
    // Calculate demand data for each ticket type
    const demandData = [];
    
    for (const [ticketType, definition] of Object.entries(ticketDefinitions)) {
      const mainEntries = entries.filter(e => e.ticketType === ticketType);
      const upgradeEntries = entries.reduce((acc, entry) => {
        if (entry.upgrades) {
          entry.upgrades.forEach((upgrade) => {
            if (upgrade.ticketType === ticketType) {
              acc.push({
                adults: upgrade.adults || 0,
                kids: upgrade.kids || 0,
                finalAmount: definition.price * ((upgrade.adults || 0) + (upgrade.kids || 0))
              });
            }
          });
        }
        return acc;
      }, []);
      
      const totalBookings = mainEntries.length + upgradeEntries.length;
      const totalAdults = mainEntries.reduce((sum, e) => sum + (e.adults || 0), 0) + 
                          upgradeEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
      const totalKids = mainEntries.reduce((sum, e) => sum + (e.kids || 0), 0) + 
                       upgradeEntries.reduce((sum, e) => sum + (e.kids || 0), 0);
      const totalPeople = totalAdults + totalKids;
      const revenue = mainEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0) + 
                     upgradeEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      
      // Calculate peak hours
      const hourlyData = new Array(24).fill(0);
      mainEntries.forEach(entry => {
        const hour = dayjs(entry.createdAt).hour();
        hourlyData[hour]++;
      });
      const peakHours = hourlyData
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(item => `${item.hour}:00`);
      
      // Calculate weekly trend (last 7 days)
      const weeklyTrend = new Array(7).fill(0);
      for (let i = 0; i < 7; i++) {
        const dayStart = dayjs().subtract(i, 'day').startOf('day').toDate();
        const dayEnd = dayjs().subtract(i, 'day').endOf('day').toDate();
        const dayEntries = mainEntries.filter(e => e.createdAt >= dayStart && e.createdAt <= dayEnd);
        weeklyTrend[6 - i] = dayEntries.length;
      }
      
      // Calculate demand score (weighted by bookings, people, and revenue)
      const demandScore = (totalBookings * 0.3 + totalPeople * 0.4 + (revenue / definition.price) * 0.3);
      
      // Calculate upgrade potential
      const upgradePotential = calculateUpgradePotential(ticketType, entries, ticketDefinitions);
      
      demandData.push({
        ticketType,
        ticketName: definition.name,
        totalBookings,
        totalPeople,
        totalAdults,
        totalKids,
        revenue,
        averagePeoplePerBooking: totalBookings > 0 ? totalPeople / totalBookings : 0,
        demandScore,
        upgradePotential,
        peakHours,
        weeklyTrend,
        monthlyTrend: weeklyTrend // Simplified for demo
      });
    }
    
    // Sort by demand score
    demandData.sort((a, b) => b.demandScore - a.demandScore);
    
    // Calculate upgrade insights
    const upgradeInsights = calculateUpgradeInsights(entries, ticketDefinitions);
    
    // Generate recommendations
    const recommendations = generateRecommendations(demandData, upgradeInsights);
    
    res.json({
      period: `Last ${days} days`,
      highestDemand: demandData[0],
      ranking: demandData,
      upgradeInsights,
      recommendations,
      summary: {
        totalBookings: demandData.reduce((sum, d) => sum + d.totalBookings, 0),
        totalPeople: demandData.reduce((sum, d) => sum + d.totalPeople, 0),
        totalRevenue: demandData.reduce((sum, d) => sum + d.revenue, 0),
        mostPopularHour: findMostPopularHour(entries),
        growthRate: calculateGrowthRate(entries)
      }
    });
  } catch (err) {
    console.error('Error in analysis:', err);
    res.status(500).json({ message: err.message });
  }
});

function calculateUpgradePotential(ticketType, entries, ticketDefinitions) {
  const ticketPrice = ticketDefinitions[ticketType].price;
  const lowerTicketTypes = Object.entries(ticketDefinitions)
    .filter(([type, def]) => def.price < ticketPrice)
    .map(([type]) => type);
  
  let potential = 0;
  lowerTicketTypes.forEach(lowerType => {
    const lowerEntries = entries.filter(e => e.ticketType === lowerType);
    potential += lowerEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
  });
  
  return potential;
}

function calculateUpgradeInsights(entries, ticketDefinitions) {
  const insights = [];
  
  Object.entries(ticketDefinitions).forEach(([fromType, fromDef]) => {
    Object.entries(ticketDefinitions).forEach(([toType, toDef]) => {
      if (toDef.price > fromDef.price) {
        const fromEntries = entries.filter(e => e.ticketType === fromType);
        const upgradeCount = fromEntries.reduce((count, entry) => {
          if (entry.upgrades) {
            const hasUpgrade = entry.upgrades.some((upgrade) => upgrade.ticketType === toType);
            return hasUpgrade ? count + 1 : count;
          }
          return count;
        }, 0);
        
        const upgradeRevenue = upgradeCount * (toDef.price - fromDef.price);
        const upgradeRate = fromEntries.length > 0 ? (upgradeCount / fromEntries.length) * 100 : 0;
        const potentialRevenue = (fromEntries.length - upgradeCount) * (toDef.price - fromDef.price);
        
        if (upgradeCount > 0) {
          insights.push({
            fromTicketType: fromType,
            toTicketType: toType,
            upgradeCount,
            upgradeRevenue,
            upgradeRate,
            potentialRevenue
          });
        }
      }
    });
  });
  
  return insights.sort((a, b) => b.upgradeRevenue - a.upgradeRevenue).slice(0, 10);
}

function generateRecommendations(demandData, upgradeInsights) {
  const recommendations = [];
  
  // Highest demand recommendation
  const highest = demandData[0];
  recommendations.push(`${highest.ticketName} (₹${highest.ticketType}) has the highest demand with ${highest.totalBookings} bookings and ${highest.totalPeople} visitors.`);
  
  // Low demand recommendation
  const lowest = demandData[demandData.length - 1];
  if (lowest.totalBookings < highest.totalBookings * 0.3) {
    recommendations.push(`${lowest.ticketName} (₹${lowest.ticketType}) has low demand (${lowest.totalBookings} bookings). Consider promotional offers or bundling.`);
  }
  
  // Upgrade potential recommendation
  const highUpgradePotential = demandData.filter(d => d.upgradePotential > 10);
  if (highUpgradePotential.length > 0) {
    recommendations.push(`${highUpgradePotential[0].ticketName} has high upgrade potential (${highUpgradePotential[0].upgradePotential} people could upgrade from lower tiers).`);
  }
  
  // Peak hour recommendation
  const peakHours = demandData.flatMap(d => d.peakHours);
  const mostCommonHour = getMostCommonHour(peakHours);
  recommendations.push(`Peak booking time is around ${mostCommonHour}. Ensure adequate staffing during this period.`);
  
  // Upgrade path recommendation
  if (upgradeInsights.length > 0) {
    const topUpgrade = upgradeInsights[0];
    recommendations.push(`Most profitable upgrade path: ₹${topUpgrade.fromTicketType} → ₹${topUpgrade.toTicketType} (${topUpgrade.upgradeRate.toFixed(1)}% upgrade rate, ₹${topUpgrade.upgradeRevenue} revenue).`);
  }
  
  return recommendations;
}

function findMostPopularHour(entries) {
  const hourlyData = new Array(24).fill(0);
  entries.forEach(entry => {
    const hour = dayjs(entry.createdAt).hour();
    hourlyData[hour]++;
  });
  
  const maxHour = hourlyData.indexOf(Math.max(...hourlyData));
  return `${maxHour}:00`;
}

function calculateGrowthRate(entries) {
  const now = dayjs();
  const lastWeekStart = now.subtract(7, 'day').startOf('day');
  const lastWeekEnd = now.subtract(0, 'day').endOf('day');
  const prevWeekStart = now.subtract(14, 'day').startOf('day');
  const prevWeekEnd = now.subtract(7, 'day').endOf('day');
  
  const lastWeekCount = entries.filter(e => dayjs(e.createdAt).isAfter(lastWeekStart) && dayjs(e.createdAt).isBefore(lastWeekEnd)).length;
  const prevWeekCount = entries.filter(e => dayjs(e.createdAt).isAfter(prevWeekStart) && dayjs(e.createdAt).isBefore(prevWeekEnd)).length;
  
  if (prevWeekCount === 0) return 0;
  return ((lastWeekCount - prevWeekCount) / prevWeekCount) * 100;
}

function getMostCommonHour(hours) {
  const hourCounts = {};
  hours.forEach(hour => {
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  return Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || '12:00';
}

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB or use in-memory
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/south-water-park';
    
    try {
      await mongoose.connect(mongoUri);
      console.log('MongoDB connected');
    } catch (error) {
      console.log('MongoDB connection failed, using in-memory database for demo');
      // For demo purposes, we'll work without a database
    }
    
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
      console.log(`Ticket Demand Analysis Server running on http://localhost:${PORT}`);
      console.log('Access the analysis at: http://localhost:5001/api/ticket-demand-analysis/analysis');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
