// Debug script to test API calls
const API_BASE = 'https://south-water-park-backend.onrender.com/api';

async function debugAPI() {
    console.log('🔍 Starting API Debug...');
    
    // Step 1: Test login
    console.log('1. Testing login...');
    try {
        const loginResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin1', password: 'admin1' })
        });
        const loginData = await loginResponse.json();
        console.log('✅ Login successful:', loginData.success);
        console.log('🎫 Token received:', loginData.token ? 'YES' : 'NO');
        
        if (loginData.token) {
            // Step 2: Test entries with token
            console.log('2. Testing entries with token...');
            const entriesResponse = await fetch(`${API_BASE}/entries`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${loginData.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('📊 Entries response status:', entriesResponse.status);
            console.log('📊 Entries response headers:', Object.fromEntries(entriesResponse.headers.entries()));
            
            const entriesData = await entriesResponse.json();
            console.log('✅ Entries data structure:', {
                hasSuccess: 'success' in entriesData,
                hasData: 'data' in entriesData,
                hasEntries: entriesData.data && 'entries' in entriesData.data,
                entriesCount: entriesData.data?.entries?.length || 0,
                total: entriesData.data?.total || 0
            });
            
            if (entriesData.data?.entries?.length > 0) {
                console.log('🎉 SUCCESS: Entries found!');
                console.log('📋 First entry:', entriesData.data.entries[0]);
            } else {
                console.log('❌ ISSUE: No entries found');
            }
        }
    } catch (error) {
        console.error('❌ Debug failed:', error);
    }
}

debugAPI();
