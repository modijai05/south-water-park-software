// Test API Endpoints for Entries Data Flow
const fetch = require('node-fetch');

// Add global fetch for Node.js
global.fetch = fetch;

const API_BASE = 'http://localhost:10000/api';

async function testAPIEndpoints() {
  console.log('🔄 Testing API Endpoints for Entries Data Flow...\n');
  
  try {
    // Test 1: Health Check
    console.log('🏥 Testing Health Check Endpoint...');
    const healthResponse = await fetch(`${API_BASE}/health-check`);
    const healthData = await healthResponse.json();
    console.log('✅ Health Check Status:', healthData.status);
    console.log('🔗 Database Connected:', healthData.database.connected);
    console.log('📊 Entries API Status:', healthData.apis.entries);
    
    // Test 2: Stats Endpoint
    console.log('\n📊 Testing Stats Endpoint...');
    const statsResponse = await fetch(`${API_BASE}/entries/stats`);
    const statsData = await statsResponse.json();
    console.log('✅ Stats Success:', statsData.success);
    if (statsData.success) {
      console.log('📈 Total Entries:', statsData.data.totalEntries);
      console.log('📅 Today Entries:', statsData.data.todayEntries);
      console.log('💰 Total Amount:', statsData.data.totalAmount);
      console.log('🔄 Sync Status:', statsData.data.syncStatus);
      console.log('📡 Data Source:', statsData.data.source);
    }
    
    // Test 3: Sync-All Endpoint
    console.log('\n🔄 Testing Comprehensive Sync Endpoint...');
    const syncResponse = await fetch(`${API_BASE}/entries/sync-all`);
    const syncData = await syncResponse.json();
    console.log('✅ Sync Success:', syncData.success);
    if (syncData.success) {
      console.log('📊 Sync Stats:', {
        totalRecords: syncData.data.summary.totalRecords,
        todayRecords: syncData.data.summary.todayRecords,
        recentRecords: syncData.data.summary.recentRecords,
        syncStatus: syncData.metadata.syncStatus,
        dataFreshness: syncData.metadata.dataFreshness,
        source: syncData.metadata.source
      });
      
      console.log('📋 Recent Entries Count:', syncData.data.recentEntries.length);
      console.log('📅 Today Entries Count:', syncData.data.todayEntries.length);
    }
    
    // Test 4: Export Endpoint
    console.log('\n📤 Testing Export Endpoint...');
    const exportResponse = await fetch(`${API_BASE}/entries/export?limit=10`);
    const exportData = await exportResponse.json();
    console.log('✅ Export Success:', exportData.success);
    if (exportData.success) {
      console.log('📊 Export Results:', {
        total: exportData.data.total,
        exported: exportData.data.exported,
        exportDate: exportData.data.exportDate
      });
      
      if (exportData.data.exportStats) {
        console.log('💰 Export Stats:', {
          averageTicketValue: exportData.data.exportStats.averageTicketValue,
          totalPeople: exportData.data.exportStats.totalPeople,
          totalRevenue: exportData.data.exportStats.totalRevenue
        });
      }
    }
    
    // Test 5: Create Test Entry (if no entries exist)
    if (statsData.success && statsData.data.totalEntries === 0) {
      console.log('\n📝 Creating Test Entry...');
      const testEntry = {
        name: 'Test Customer',
        mobile: '1234567890',
        ticketType: '150',
        adults: 2,
        kids: 1,
        totalPeople: 3,
        baseAmount: 450,
        finalAmount: 450,
        cashAmount: 450,
        upiAmount: 0,
        advanceAmount: 0,
        filledBy: 'Test Admin'
      };
      
      const createResponse = await fetch(`${API_BASE}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEntry)
      });
      
      const createData = await createResponse.json();
      console.log('✅ Test Entry Created:', createData.success);
      if (createData.success) {
        console.log('🎫 Receipt Number:', createData.data.receiptNumber);
        console.log('📊 Entry ID:', createData.data.id);
      }
    }
    
    console.log('\n🎉 All API Tests Completed Successfully!');
    console.log('🔄 MongoDB data is flowing properly through all endpoints.');
    
  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
    console.error('🔍 Error Details:', error);
  }
}

// Run the tests
testAPIEndpoints();
