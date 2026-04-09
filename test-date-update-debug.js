#!/usr/bin/env node

/**
 * PROFESSIONAL DATE UPDATE DEBUG TEST
 * Tests the complete date update flow end-to-end
 */

// Use built-in fetch for Node.js 18+
// const fetch = require('node-fetch');

// Configuration
const API_BASE = 'https://south-water-park-backend.onrender.com/api';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

let authToken = null;

// Utility functions
const log = (message, data = null) => {
  console.log(`\n🔍 ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const logError = (message, data = null) => {
  console.error(`\n❌ ${message}`);
  if (data) {
    console.error(JSON.stringify(data, null, 2));
  }
};

const success = (message, data = null) => {
  console.log(`\n✅ ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

// API helper functions
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (err) {
    logError(`API Request failed: ${endpoint}`, err.message);
    throw err;
  }
}

// Login and get token
async function login() {
  log('Logging in to get authentication token...');
  
  try {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(TEST_CREDENTIALS)
    });

    authToken = response.token;
    success('Login successful', { token: authToken?.substring(0, 20) + '...' });
    return true;
  } catch (err) {
    logError('Login failed', err.message);
    return false;
  }
}

// Get list of entries
async function getEntries() {
  log('Fetching entries list...');
  
  try {
    const response = await apiRequest('/entries?limit=10');
    
    if (!response.success || !response.data || !response.data.entries) {
      throw new Error('Invalid response structure');
    }

    success('Entries fetched successfully', { 
      total: response.data.total,
      entriesCount: response.data.entries.length
    });

    return response.data.entries;
  } catch (err) {
    logError('Failed to fetch entries', err.message);
    return [];
  }
}

// Test date update on an entry
async function testDateUpdate(entry) {
  log(`Testing date update on entry: ${entry.name} (${entry._id})`);

  // Create a test date (yesterday)
  const testDate = new Date();
  testDate.setDate(testDate.getDate() - 1); // Yesterday
  testDate.setHours(15, 30, 0, 0); // 3:30 PM

  const updateData = {
    entryDate: testDate,
    name: entry.name,
    mobile: entry.mobile,
    ticketType: entry.ticketType,
    adults: entry.adults,
    kids: entry.kids,
    totalPeople: entry.totalPeople,
    finalAmount: entry.finalAmount
  };

  log('Sending update request with date:', {
    entryId: entry._id,
    originalEntryDate: entry.entryDate,
    originalCreatedAt: entry.createdAt,
    newEntryDate: testDate.toISOString(),
    newEntryDateType: typeof testDate
  });

  try {
    const response = await apiRequest(`/entries/${entry._id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });

    if (!response.success || !response.data || !response.data.entry) {
      throw new Error('Invalid update response');
    }

    const updatedEntry = response.data.entry;

    success('Update request successful', {
      entryId: updatedEntry._id,
      updatedEntryDate: updatedEntry.entryDate,
      updatedEntryDateType: typeof updatedEntry.entryDate,
      updatedCreatedAt: updatedEntry.createdAt,
      effectiveDate: updatedEntry.entryDate || updatedEntry.createdAt
    });

    // Verify the date was saved correctly
    const savedDate = new Date(updatedEntry.entryDate);
    const expectedDate = new Date(testDate);

    const dateMatches = !isNaN(savedDate.getTime()) && 
                       Math.abs(savedDate.getTime() - expectedDate.getTime()) < 1000; // Within 1 second

    if (dateMatches) {
      success('✅ Date saved correctly to MongoDB!', {
        expected: expectedDate.toISOString(),
        actual: savedDate.toISOString(),
        matches: dateMatches
      });
    } else {
      logError('❌ Date NOT saved correctly!', {
        expected: expectedDate.toISOString(),
        actual: savedDate.toISOString(),
        matches: dateMatches,
        isValid: !isNaN(savedDate.getTime())
      });
    }

    return updatedEntry;
  } catch (err) {
    logError('Date update failed', err.message);
    return null;
  }
}

// Verify entry after update by fetching it again
async function verifyUpdate(entryId) {
  log(`Verifying entry after update by fetching fresh data: ${entryId}`);

  try {
    const response = await apiRequest(`/entries/${entryId}`);

    if (!response.success || !response.data || !response.data.entry) {
      throw new Error('Invalid get response');
    }

    const freshEntry = response.data.entry;

    success('Fresh entry data fetched', {
      entryId: freshEntry._id,
      entryDate: freshEntry.entryDate,
      entryDateType: typeof freshEntry.entryDate,
      createdAt: freshEntry.createdAt,
      effectiveDate: freshEntry.entryDate || freshEntry.createdAt
    });

    return freshEntry;
  } catch (err) {
    logError('Failed to verify update', err.message);
    return null;
  }
}

// Main test function
async function runTest() {
  log('🚀 STARTING PROFESSIONAL DATE UPDATE DEBUG TEST');

  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    logError('Cannot proceed without authentication');
    process.exit(1);
  }

  // Step 2: Get entries
  const entries = await getEntries();
  if (entries.length === 0) {
    logError('No entries found to test with');
    process.exit(1);
  }

  // Step 3: Test date update on first entry
  const testEntry = entries[0];
  log('Selected test entry:', {
    id: testEntry._id,
    name: testEntry.name,
    currentEntryDate: testEntry.entryDate,
    createdAt: testEntry.createdAt,
    effectiveDate: testEntry.entryDate || testEntry.createdAt
  });

  // Step 4: Perform date update
  const updatedEntry = await testDateUpdate(testEntry);
  if (!updatedEntry) {
    logError('Date update test failed');
    process.exit(1);
  }

  // Step 5: Verify update by fetching fresh data
  const verifiedEntry = await verifyUpdate(updatedEntry._id);
  if (!verifiedEntry) {
    logError('Update verification failed');
    process.exit(1);
  }

  // Step 6: Final analysis
  log('\n🎯 FINAL ANALYSIS');
  
  const originalEffectiveDate = testEntry.entryDate || testEntry.createdAt;
  const updatedEffectiveDate = verifiedEntry.entryDate || verifiedEntry.createdAt;
  
  const dateChanged = originalEffectiveDate !== updatedEffectiveDate;
  const entryDateExists = !!verifiedEntry.entryDate;
  const entryDateValid = verifiedEntry.entryDate && !isNaN(new Date(verifiedEntry.entryDate).getTime());

  success('TEST COMPLETED', {
    originalEffectiveDate,
    updatedEffectiveDate,
    dateChanged,
    entryDateExists,
    entryDateValid,
    testPassed: dateChanged && entryDateExists && entryDateValid
  });

  if (dateChanged && entryDateExists && entryDateValid) {
    console.log('\n🎉 DATE UPDATE FUNCTIONALITY IS WORKING CORRECTLY!');
  } else {
    console.log('\n💥 DATE UPDATE FUNCTIONALITY HAS ISSUES!');
    console.log('- Date changed:', dateChanged);
    console.log('- Entry date exists:', entryDateExists);
    console.log('- Entry date valid:', entryDateValid);
  }
}

// Run the test
runTest().catch(err => {
  logError('Test execution failed', err.message);
  process.exit(1);
});
