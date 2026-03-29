// Full Test of Analytics Endpoints with User Creation
const API_BASE = 'http://localhost:5000/api';

async function getAuthToken() {
  try {
    return await login('testuser', 'test123');
  } catch (error) {
    console.error('Login error:', error.message);
    return null;
  }
}

async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful');
      return data.token;
    }
    console.log('❌ Login failed');
    return null;
  } catch (error) {
    console.error('Login error:', error.message);
    return null;
  }
}

async function testAnalyticsEndpoints(token) {
  console.log('\n🧪 Testing Analytics Endpoints with Authentication...\n');
  
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
  
  const endpoints = [
    { name: 'Demand', url: '/analytics/demand?timeRange=30d' },
    { name: 'Upgrades', url: '/analytics/upgrades?timeRange=30d' },
    { name: 'Time Series', url: '/analytics/timeseries?timeRange=30d' },
    { name: 'Peak Hours', url: '/analytics/peak-hours?timeRange=30d' },
    { name: 'Customer Preferences', url: '/analytics/customer-preferences?timeRange=30d' },
    { name: 'Date Wise', url: '/analytics/date-wise' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Testing ${endpoint.name}...`);
      const response = await fetch(`${API_BASE}${endpoint.url}`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        const dataArray = Array.isArray(data) ? data : [data];
        console.log(`✅ ${endpoint.name}: SUCCESS - Received ${dataArray.length} items`);
        
        if (dataArray.length > 0 && typeof dataArray[0] === 'object') {
          console.log(`   Sample data keys: ${Object.keys(dataArray[0]).join(', ')}`);
        }
      } else if (response.status === 404) {
        console.log(`❌ ${endpoint.name}: NOT FOUND (404)`);
      } else if (response.status === 401) {
        console.log(`🔒 ${endpoint.name}: UNAUTHORIZED (401)`);
      } else {
        const errorText = await response.text();
        console.log(`❌ ${endpoint.name}: ERROR ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ERROR - ${error.message}`);
    }
  }
  
  console.log('\n🎯 Analytics test completed!');
}

async function runFullTest() {
  console.log('🚀 Starting Full Analytics Test...\n');
  
  const token = await getAuthToken();
  
  if (token) {
    await testAnalyticsEndpoints(token);
  } else {
    console.log('❌ Cannot authenticate, skipping analytics tests');
  }
}

runFullTest().catch(console.error);
