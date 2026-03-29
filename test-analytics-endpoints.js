// Test Analytics Endpoints
const API_BASE = 'http://localhost:5000/api';

// Test credentials (you may need to adjust these)
const testUser = {
  username: 'admin',
  password: 'admin123'
};

async function login() {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser)
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.token;
    }
    return null;
  } catch (error) {
    console.error('Login failed:', error.message);
    return null;
  }
}

async function testEndpoints() {
  console.log('🧪 Testing Analytics Endpoints...\n');
  
  // Try to login first
  const token = await login();
  if (!token) {
    console.log('❌ Cannot login, testing without authentication...\n');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
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
        console.log(`❌ ${endpoint.name}: ERROR ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ERROR - ${error.message}`);
    }
  }
  
  console.log('\n🎯 Test completed!');
}

testEndpoints().catch(console.error);
