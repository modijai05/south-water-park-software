/**
 * API-based script to fix previous entries with missing or incorrect entryDate
 * This script uses the existing API endpoints to fix entries without direct MongoDB access
 * 
 * This script will:
 * 1. Fetch all entries using the API
 * 2. Identify entries without entryDate
 * 3. Update each entry to set entryDate to createdAt
 * 4. Verify the fix
 */

const API_BASE = 'https://south-water-park-backend.onrender.com/api';

// Get token from localStorage or use a test token
// You'll need to authenticate first to get a valid token
const TOKEN = process.env.API_TOKEN || 'YOUR_TOKEN_HERE';

async function fixEntriesViaAPI() {
  try {
    console.log('🔧 Starting API-based fix for previous entries...');

    // Step 1: Fetch all entries
    console.log('\n📊 Step 1: Fetching all entries...');
    const response = await fetch(`${API_BASE}/entries?limit=50000`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch entries: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const entries = data.data?.entries || [];
    console.log(`Fetched ${entries.length} entries`);

    // Step 2: Identify entries without entryDate
    console.log('\n📊 Step 2: Identifying entries without entryDate...');
    const entriesWithoutEntryDate = entries.filter(entry => !entry.entryDate);
    console.log(`Found ${entriesWithoutEntryDate.length} entries without entryDate`);

    if (entriesWithoutEntryDate.length === 0) {
      console.log('✅ All entries already have entryDate!');
      return;
    }

    // Step 3: Update each entry
    console.log('\n🔧 Step 3: Updating entries to set entryDate...');
    let fixedCount = 0;
    let errorCount = 0;

    for (const entry of entriesWithoutEntryDate) {
      try {
        const updateResponse = await fetch(`${API_BASE}/entries/${entry._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            entryDate: entry.createdAt
          })
        });

        if (updateResponse.ok) {
          fixedCount++;
          console.log(`✅ Fixed entry ${entry._id} (${entry.receiptNumber || 'no receipt'})`);
        } else {
          errorCount++;
          console.error(`❌ Failed to fix entry ${entry._id}: ${updateResponse.status}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error fixing entry ${entry._id}:`, error.message);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Fix summary: ${fixedCount} entries fixed, ${errorCount} errors`);

    // Step 4: Verify the fix
    console.log('\n📊 Step 4: Verifying the fix...');
    const verifyResponse = await fetch(`${API_BASE}/entries?limit=50000`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const verifyEntries = verifyData.data?.entries || [];
      const remainingWithoutEntryDate = verifyEntries.filter(entry => !entry.entryDate);
      
      console.log(`\n📊 Verification results:`);
      console.log(`- Total entries: ${verifyEntries.length}`);
      console.log(`- Entries with entryDate: ${verifyEntries.length - remainingWithoutEntryDate.length}`);
      console.log(`- Entries without entryDate: ${remainingWithoutEntryDate.length}`);

      if (remainingWithoutEntryDate.length === 0) {
        console.log('\n✅ SUCCESS: All entries now have valid entryDate!');
      } else {
        console.log('\n⚠️ WARNING: Some entries still need fixing');
      }
    }

  } catch (error) {
    console.error('❌ Error in API fix script:', error);
  }
}

// Instructions for running this script
console.log('='.repeat(60));
console.log('API-BASED ENTRY DATE FIX SCRIPT');
console.log('='.repeat(60));
console.log('\nTo run this script:');
console.log('1. Get a valid API token by logging into the application');
console.log('2. Set the TOKEN variable in this script or use environment variable');
console.log('3. Run: node fix-entries-api.js');
console.log('\nOr run with token:');
console.log('  API_TOKEN=your_token_here node fix-entries-api.js');
console.log('='.repeat(60));
console.log('\n');

// Uncomment to run the fix
// fixEntriesViaAPI();
