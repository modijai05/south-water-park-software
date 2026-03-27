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

async function runTests() {
  console.log('🧪 Testing API endpoints...\n');

  try {
    // Test 1: GET ticket-config
    console.log('1️⃣ Testing GET /api/ticket-config...');
    const getConfigResponse = await testAPI('GET', '/api/ticket-config');
    console.log(`Status: ${getConfigResponse.statusCode}`);
    console.log('Response:', JSON.stringify(getConfigResponse.data, null, 2));
    console.log('');

    // Test 2: PUT ticket-config update
    console.log('2️⃣ Testing PUT /api/ticket-config/150...');
    const updateData = {
      basePrice: 200,
      label: 'Without Food 1hr (Updated)',
      isActive: true
    };
    const updateResponse = await testAPI('PUT', '/api/ticket-config/150', updateData);
    console.log(`Status: ${updateResponse.statusCode}`);
    console.log('Response:', JSON.stringify(updateResponse.data, null, 2));
    console.log('');

    // Test 3: GET updated ticket-config
    console.log('3️⃣ Testing GET /api/ticket-config after update...');
    const getUpdatedResponse = await testAPI('GET', '/api/ticket-config');
    console.log(`Status: ${getUpdatedResponse.statusCode}`);
    console.log('Response:', JSON.stringify(getUpdatedResponse.data, null, 2));
    console.log('');

    // Test 4: Test entries endpoint
    console.log('4️⃣ Testing GET /api/entries/stats...');
    const statsResponse = await testAPI('GET', '/api/entries/stats');
    console.log(`Status: ${statsResponse.statusCode}`);
    console.log('Response:', JSON.stringify(statsResponse.data, null, 2));
    console.log('');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

runTests();
