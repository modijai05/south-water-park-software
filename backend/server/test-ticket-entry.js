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

async function testTicketEntryWorkflow() {
  console.log('🧪 Testing complete ticket entry workflow...\n');

  try {
    // Test 1: Create a ticket entry
    console.log('1️⃣ Testing POST /api/entries (Create ticket entry)...');
    const ticketEntry = {
      name: 'Test Customer',
      mobile: '9876543210',
      ticketType: '300',
      adults: 2,
      kids: 1,
      cashAmount: 800,
      upiAmount: 0,
      advanceAmount: 0,
      finalAmount: 800,
      totalPeople: 3,
      receiptNumber: `TEST${Date.now()}`,
      filledBy: 'admin1'
    };
    
    const createResponse = await testAPI('POST', '/api/entries', ticketEntry);
    console.log(`Status: ${createResponse.statusCode}`);
    console.log('Response:', JSON.stringify(createResponse.data, null, 2));
    console.log('');

    // Test 2: Get entries list
    console.log('2️⃣ Testing GET /api/entries (List entries)...');
    const listResponse = await testAPI('GET', '/api/entries?limit=5');
    console.log(`Status: ${listResponse.statusCode}`);
    console.log('Response:', JSON.stringify(listResponse.data, null, 2));
    console.log('');

    // Test 3: Get stats
    console.log('3️⃣ Testing GET /api/entries/stats (Get statistics)...');
    const statsResponse = await testAPI('GET', '/api/entries/stats');
    console.log(`Status: ${statsResponse.statusCode}`);
    console.log('Response:', JSON.stringify(statsResponse.data, null, 2));
    console.log('');

    // Test 4: Get today's entries
    console.log('4️⃣ Testing GET /api/entries?today=true (Today\'s entries)...');
    const todayResponse = await testAPI('GET', '/api/entries?today=true&limit=10');
    console.log(`Status: ${todayResponse.statusCode}`);
    console.log('Response:', JSON.stringify(todayResponse.data, null, 2));
    console.log('');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testTicketEntryWorkflow();
