const mongoose = require('mongoose');
const { Entry } = require('./src/models/Entry.js');

async function testStats() {
  try {
    await mongoose.connect('mongodb://localhost:27017/south-water-park');
    console.log('Connected to MongoDB');
    
    // Find entries with upgrades
    const entriesWithUpgrades = await Entry.find({ 'upgrades.0': { '$exists': true } }).limit(3);
    console.log('\n=== Entries with upgrades ===');
    entriesWithUpgrades.forEach((entry, i) => {
      console.log(`Entry ${i + 1}:`, {
        id: entry._id,
        ticketType: entry.ticketType,
        adults: entry.adults,
        kids: entry.kids,
        totalPeople: entry.totalPeople,
        upgrades: entry.upgrades
      });
    });
    
    // Test today's aggregation
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    console.log('\n=== Testing Today\'s Stats Aggregation ===');
    const todayAgg = await Entry.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { 
        $group: {
          _id: null,
          totalPeople: { $sum: '$totalPeople' },
          adults: { $sum: '$adults' },
          kids: { $sum: '$kids' },
          '300': { 
            $sum: { 
              $add: [
                { $cond: [{ $eq: ['$ticketType', '300'] }, '$totalPeople', 0] },
                { $sum: { $map: { input: '$upgrades', as: 'upgrade', in: { $cond: [{ $eq: ['$$upgrade.ticketType', '300'] }, '$totalPeople', 0] } } } }
              ] 
            } 
          },
          '300Adults': { 
            $sum: { 
              $add: [
                { $cond: [{ $eq: ['$ticketType', '300'] }, '$adults', 0] },
                { $sum: { $map: { input: '$upgrades', as: 'upgrade', in: { $cond: [{ $eq: ['$$upgrade.ticketType', '300'] }, '$adults', 0] } } } }
              ] 
            } 
          },
          '300Kids': { 
            $sum: { 
              $add: [
                { $cond: [{ $eq: ['$ticketType', '300'] }, '$kids', 0] },
                { $sum: { $map: { input: '$upgrades', as: 'upgrade', in: { $cond: [{ $eq: ['$$upgrade.ticketType', '300'] }, '$kids', 0] } } } }
              ] 
            } 
          }
        }
      }
    ]);
    
    console.log('Today\'s aggregation result:', todayAgg[0]);
    
    // Test total aggregation
    console.log('\n=== Testing Total Stats Aggregation ===');
    const totalAgg = await Entry.aggregate([
      { 
        $group: {
          _id: null,
          totalPeople: { $sum: '$totalPeople' },
          adults: { $sum: '$adults' },
          kids: { $sum: '$kids' },
          '300': { 
            $sum: { 
              $add: [
                { $cond: [{ $eq: ['$ticketType', '300'] }, '$totalPeople', 0] },
                { $sum: { $map: { input: '$upgrades', as: 'upgrade', in: { $cond: [{ $eq: ['$$upgrade.ticketType', '300'] }, '$totalPeople', 0] } } } }
              ] 
            } 
          },
          '300Adults': { 
            $sum: { 
              $add: [
                { $cond: [{ $eq: ['$ticketType', '300'] }, '$adults', 0] },
                { $sum: { $map: { input: '$upgrades', as: 'upgrade', in: { $cond: [{ $eq: ['$$upgrade.ticketType', '300'] }, '$adults', 0] } } } }
              ] 
            } 
          },
          '300Kids': { 
            $sum: { 
              $add: [
                { $cond: [{ $eq: ['$ticketType', '300'] }, '$kids', 0] },
                { $sum: { $map: { input: '$upgrades', as: 'upgrade', in: { $cond: [{ $eq: ['$$upgrade.ticketType', '300'] }, '$kids', 0] } } } }
              ] 
            } 
          }
        }
      }
    ]);
    
    console.log('Total aggregation result:', totalAgg[0]);
    
    await mongoose.connection.close();
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testStats();
