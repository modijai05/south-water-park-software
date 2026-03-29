// 🎯 FINAL SYSTEM TEST: Complete MongoDB and Form Submission Verification
const mongoose = require('mongoose');
const https = require('https');

async function testCompleteSystem() {
  console.log('🚀 STARTING COMPLETE SYSTEM TEST\n');
  
  // Test 1: MongoDB Connection
  console.log('📊 Test 1: MongoDB Connection');
  try {
    const mongoUri = 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      connectTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ MongoDB connected successfully');
    
    const db = mongoose.connection.db;
    const entriesCount = await db.collection('entries').countDocuments();
    console.log(`📋 Total entries in database: ${entriesCount}`);
    
    await mongoose.connection.close();
    console.log('✅ MongoDB test completed\n');
    
  } catch (error) {
    console.error('❌ MongoDB test failed:', error.message);
  }
  
  // Test 2: Backend API Health
  console.log('🏥 Test 2: Backend API Health');
  try {
    const healthResponse = await makeRequest('https://south-water-park-backend.onrender.com/health');
    console.log('📋 Health response:', healthResponse);
    
    if (healthResponse.includes('database')) {
      console.log('✅ Health endpoint shows detailed info (new code deployed)');
    } else {
      console.log('⚠️ Health endpoint shows minimal response (old code still running)');
    }
    console.log('✅ Health test completed\n');
    
  } catch (error) {
    console.error('❌ Health test failed:', error.message);
  }
  
  // Test 3: Sync-all Endpoint
  console.log('🔄 Test 3: Sync-all Endpoint');
  try {
    const syncResponse = await makeRequest('https://south-water-park-backend.onrender.com/api/entries/sync-all');
    console.log('📋 Sync-all response preview:', syncResponse.substring(0, 200) + '...');
    
    if (syncResponse.includes('fallbackMode')) {
      console.log('⚠️ Sync-all in fallback mode (route issue persists)');
    } else if (syncResponse.includes('stats') && syncResponse.includes('recentEntries')) {
      console.log('✅ Sync-all working properly (route fixed)');
    } else {
      console.log('❓ Sync-all response unclear');
    }
    console.log('✅ Sync-all test completed\n');
    
  } catch (error) {
    console.error('❌ Sync-all test failed:', error.message);
  }
  
  // Test 4: Form Submission
  console.log('📝 Test 4: Form Submission');
  try {
    const testData = {
      name: 'Final Test User',
      mobile: '9876543210',
      ticketType: '300',
      adults: 2,
      kids: 1,
      cashAmount: 800,
      upiAmount: 0,
      advanceAmount: 0,
      finalAmount: 800,
      totalPeople: 3,
      receiptNumber: `FINAL${Date.now()}`,
      filledBy: 'final-test'
    };
    
    const submitResponse = await makePostRequest('https://south-water-park-backend.onrender.com/api/entries', testData);
    console.log('📋 Form submission response:', submitResponse.substring(0, 200) + '...');
    
    if (submitResponse.includes('201') || submitResponse.includes('success')) {
      console.log('✅ Form submission working');
    } else {
      console.log('❌ Form submission failed');
    }
    console.log('✅ Form submission test completed\n');
    
  } catch (error) {
    console.error('❌ Form submission test failed:', error.message);
  }
  
  console.log('🎯 COMPLETE SYSTEM TEST FINISHED');
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function makePostRequest(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'south-water-park-backend.onrender.com',
      port: 443,
      path: '/api/entries',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer test-token'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => resolve(`Status: ${res.statusCode}, Response: ${responseData}`));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(postData);
    req.end();
  });
}

testCompleteSystem();
