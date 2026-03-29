// Debug Login
const API_BASE = 'http://localhost:5000/api';

const testCredentials = [
  { username: 'admin1', password: 'admin123' },
  { username: 'admin1', password: 'admin' },
  { username: 'admin1', password: 'password' },
  { username: 'admin2', password: 'admin123' },
  { username: 'admin2', password: 'admin' },
  { username: 'admin3', password: 'admin123' },
  { username: 'admin3', password: 'admin' },
];

async function testLogin(credentials) {
  try {
    console.log(`🔐 Testing login with ${credentials.username}...`);
    
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful!');
      console.log('   Token:', data.token?.substring(0, 20) + '...');
      console.log('   User:', data.user?.username, '(', data.user?.role, ')');
      return data.token;
    } else {
      const text = await response.text();
      console.log(`❌ Login failed: ${text}`);
      return null;
    }
  } catch (error) {
    console.error('Login error:', error.message);
    return null;
  }
}

async function testAllLogins() {
  for (const creds of testCredentials) {
    const token = await testLogin(creds);
    if (token) {
      return token;
    }
  }
  console.log('❌ No credentials worked');
  return null;
}

testAllLogins();
