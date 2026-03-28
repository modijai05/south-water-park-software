const http = require('http');

function testFormSubmission() {
  return new Promise((resolve, reject) => {
    const testData = {
      name: 'Test Form User',
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
      filledBy: 'test-user'
    };

    const postData = JSON.stringify(testData);
    
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

    const req = require('https').request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function runFormTest() {
  console.log('🧪 Testing Form Submission to Production Backend...\n');
  
  try {
    const result = await testFormSubmission();
    
    console.log('📊 Response Status:', result.statusCode);
    console.log('📋 Response Headers:', JSON.stringify(result.headers, null, 2));
    console.log('📄 Response Body:', result.body);
    
    if (result.statusCode === 200 || result.statusCode === 201) {
      console.log('✅ Form submission successful!');
    } else {
      console.log('❌ Form submission failed with status:', result.statusCode);
    }
    
  } catch (error) {
    console.error('❌ Form submission error:', error.message);
  }
}

runFormTest();
