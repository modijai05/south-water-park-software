// Test Discount Analytics Endpoint
const API_BASE = 'http://localhost:5000/api';

async function testDiscountAnalytics() {
  try {
    console.log('🧪 Testing Discount Analytics Endpoint...\n');
    
    // Test without authentication first
    console.log('📡 Testing without authentication...');
    const response = await fetch(`${API_BASE}/analytics/discounts?timeRange=30d`);
    
    if (response.status === 401) {
      console.log('🔒 Endpoint requires authentication (expected)');
      
      // Test with authentication
      console.log('\n📡 Testing with authentication...');
      const authResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin1', password: 'admin123' })
      });
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        const token = authData.token;
        
        const authenticatedResponse = await fetch(`${API_BASE}/analytics/discounts?timeRange=30d`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (authenticatedResponse.ok) {
          const data = await authenticatedResponse.json();
          console.log('✅ Discount Analytics SUCCESS!');
          console.log('\n📊 Summary:');
          console.log(`   Total Entries: ${data.summary.totalEntries}`);
          console.log(`   Entries with Discounts: ${data.summary.entriesWithDiscounts}`);
          console.log(`   Total Discount Amount: ₹${data.summary.totalDiscountAmount}`);
          console.log(`   Total Additional Discount: ₹${data.summary.totalAdditionalDiscount}`);
          console.log(`   Total Kid Discount: ₹${data.summary.totalKidDiscount}`);
          console.log(`   Discount Rate: ${data.summary.discountRate.toFixed(2)}%`);
          console.log(`   Average Discount per Entry: ₹${data.summary.averageDiscountPerEntry.toFixed(2)}`);
          
          console.log('\n📈 Trends:');
          console.log(`   Daily Discounts: ${data.trends.dailyDiscounts.length} days`);
          console.log(`   Additional Discount Count: ${data.trends.discountTypes.additional.count}`);
          console.log(`   Kid Discount Count: ${data.trends.discountTypes.kid.count}`);
          
          console.log('\n💡 Insights:');
          console.log(`   Discount Frequency: ${data.insights.discountFrequency}`);
          console.log(`   Total Savings: ₹${data.insights.totalSavings}`);
          
          if (data.insights.highestDiscountDay) {
            console.log(`   Highest Discount Day: ${data.insights.highestDiscountDay.date} (₹${data.insights.highestDiscountDay.totalDiscount})`);
          }
          
          if (data.insights.mostDiscountedTicketType) {
            console.log(`   Most Discounted Ticket: ${data.insights.mostDiscountedTicketType.ticketType} (₹${data.insights.mostDiscountedTicketType.totalDiscount})`);
          }
          
        } else {
          console.log('❌ Authenticated request failed:', authenticatedResponse.status);
          const text = await authenticatedResponse.text();
          console.log('Error:', text);
        }
      } else {
        console.log('❌ Login failed');
      }
    } else if (response.ok) {
      console.log('⚠️ Endpoint works without authentication');
      const data = await response.json();
      console.log('Data:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Unexpected response:', response.status);
      const text = await response.text();
      console.log('Error:', text);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDiscountAnalytics();
