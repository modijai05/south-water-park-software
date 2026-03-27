const http = require('http');

function testAPI(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-for-testing'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: response });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testEntriesAPI() {
  console.log('🧪 Testing Entries API...\n');

  try {
    // Test 1: Get entries list
    console.log('1️⃣ Testing GET /api/entries...');
    const listResponse = await testAPI('GET', '/api/entries?limit=10');
    console.log(`Status: ${listResponse.statusCode}`);
    console.log('Response:', JSON.stringify(listResponse.data, null, 2));
    console.log('');

    // Test 2: Get today's entries
    console.log('2️⃣ Testing GET /api/entries?today=true...');
    const todayResponse = await testAPI('GET', '/api/entries?today=true&limit=10');
    console.log(`Status: ${todayResponse.statusCode}`);
    console.log('Response:', JSON.stringify(todayResponse.data, null, 2));
    console.log('');

    // Test 3: Get sync-all
    console.log('3️⃣ Testing GET /api/entries/sync-all...');
    const syncResponse = await testAPI('GET', '/api/entries/sync-all');
    console.log(`Status: ${syncResponse.statusCode}`);
    console.log('Response:', JSON.stringify(syncResponse.data, null, 2));
    console.log('');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testEntriesAPI();
