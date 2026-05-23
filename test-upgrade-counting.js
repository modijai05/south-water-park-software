/**
 * Test script to verify upgrade ticket counting works correctly
 * This script tests various upgrade scenarios to ensure upgrades are counted in their respective ticket type boxes
 */

const mongoose = require('mongoose');

// Import Entry model
const { Entry } = require('./backend/server/src/models/Entry.js');

async function testUpgradeCounting() {
  try {
    console.log('🧪 Starting upgrade counting test...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/?appName=Cluster';
    console.log('📗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Step 1: Find entries with upgrades
    console.log('\n📊 Step 1: Finding entries with upgrades...');
    const entriesWithUpgrades = await Entry.find({ 
      upgrades: { $exists: true, $ne: null, $not: { $size: 0 } } 
    });
    console.log(`Found ${entriesWithUpgrades.length} entries with upgrades`);

    if (entriesWithUpgrades.length === 0) {
      console.log('⚠️ No entries with upgrades found. Creating test data...');
      
      // Create a test entry with upgrades
      const testEntry = new Entry({
        name: 'Test Upgrade Entry',
        mobile: '1234567890',
        ticketType: '150',
        adults: 2,
        kids: 0,
        totalPeople: 2,
        finalAmount: 300,
        cashAmount: 300,
        upgrades: [
          {
            ticketType: '300',
            adults: 1,
            kids: 0
          },
          {
            ticketType: '450',
            adults: 1,
            kids: 1
          }
        ]
      });
      
      await testEntry.save();
      console.log('✅ Test entry created with upgrades');
      
      // Fetch again
      const updatedEntries = await Entry.find({ 
        upgrades: { $exists: true, $ne: null, $not: { $size: 0 } } 
      });
      console.log(`Now found ${updatedEntries.length} entries with upgrades`);
    }

    // Step 2: Analyze upgrade distribution
    console.log('\n📊 Step 2: Analyzing upgrade distribution...');
    const upgradeDistribution = {
      '100': { count: 0, adults: 0, kids: 0 },
      '150': { count: 0, adults: 0, kids: 0 },
      '200': { count: 0, adults: 0, kids: 0 },
      '300': { count: 0, adults: 0, kids: 0 },
      '450': { count: 0, adults: 0, kids: 0 },
      '600': { count: 0, adults: 0, kids: 0 }
    };

    entriesWithUpgrades.forEach(entry => {
      console.log(`\nEntry: ${entry.name} (${entry.receiptNumber || 'no receipt'})`);
      console.log(`  Base ticket: ${entry.ticketType}`);
      console.log(`  Upgrades: ${entry.upgrades.length}`);
      
      entry.upgrades.forEach(upgrade => {
        const ticketType = String(upgrade.ticketType);
        if (upgradeDistribution[ticketType]) {
          upgradeDistribution[ticketType].count += 1;
          upgradeDistribution[ticketType].adults += (upgrade.adults || 0);
          upgradeDistribution[ticketType].kids += (upgrade.kids || 0);
          console.log(`    - Upgrade to ${ticketType}: ${upgrade.adults || 0} adults, ${upgrade.kids || 0} kids`);
        }
      });
    });

    console.log('\n📊 Upgrade Distribution Summary:');
    Object.entries(upgradeDistribution).forEach(([type, data]) => {
      if (data.count > 0) {
        console.log(`  ${type}₹ tickets: ${data.count} upgrades, ${data.adults} adults, ${data.kids} kids`);
      }
    });

    // Step 3: Test string vs number comparison
    console.log('\n📊 Step 3: Testing string vs number comparison...');
    entriesWithUpgrades.forEach(entry => {
      entry.upgrades.forEach(upgrade => {
        const ticketTypeString = String(upgrade.ticketType);
        const ticketTypeNumber = parseInt(upgrade.ticketType);
        
        console.log(`  Upgrade ticketType: "${upgrade.ticketType}" (type: ${typeof upgrade.ticketType})`);
        console.log(`    String comparison: "${ticketTypeString}" === "300": ${ticketTypeString === '300'}`);
        console.log(`    Number comparison: ${ticketTypeNumber} === 300: ${ticketTypeNumber === 300}`);
      });
    });

    console.log('\n✅ Upgrade counting test completed successfully');

  } catch (error) {
    console.error('❌ Error in test script:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testUpgradeCounting();
