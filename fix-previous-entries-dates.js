/**
 * Script to fix previous entries with missing or incorrect entryDate
 * This script will:
 * 1. Find all entries that don't have entryDate set
 * 2. Set entryDate to their createdAt value for those entries
 * 3. Verify the fix was successful
 *
 * NOTE: This script requires direct MongoDB access. If you can't run this locally,
 * you can run it on the server or use the API-based approach in fix-entries-api.js
 */

const mongoose = require('mongoose');

// Import Entry model
const { Entry } = require('./backend/server/src/models/Entry.js');

async function fixPreviousEntries() {
  try {
    console.log('🔧 Starting fix for previous entries...');

    // Connect to MongoDB - use environment variable or default
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/?appName=Cluster';
    console.log('📗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Step 1: Find entries without entryDate
    console.log('\n📊 Step 1: Finding entries without entryDate...');
    const entriesWithoutEntryDate = await Entry.find({ entryDate: { $exists: false } });
    console.log(`Found ${entriesWithoutEntryDate.length} entries without entryDate`);

    // Step 2: Set entryDate to createdAt for those entries
    console.log('\n🔧 Step 2: Setting entryDate to createdAt for entries without entryDate...');
    let fixedCount = 0;
    let errorCount = 0;

    for (const entry of entriesWithoutEntryDate) {
      try {
        await Entry.findByIdAndUpdate(entry._id, {
          entryDate: entry.createdAt
        });
        fixedCount++;
        console.log(`✅ Fixed entry ${entry._id} (${entry.receiptNumber || 'no receipt'})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error fixing entry ${entry._id}:`, error.message);
      }
    }

    console.log(`\n📊 Fix summary: ${fixedCount} entries fixed, ${errorCount} errors`);

    // Step 3: Find entries with invalid entryDate (null or undefined)
    console.log('\n📊 Step 3: Finding entries with null/undefined entryDate...');
    const entriesWithNullEntryDate = await Entry.find({
      $or: [
        { entryDate: null },
        { entryDate: undefined }
      ]
    });
    console.log(`Found ${entriesWithNullEntryDate.length} entries with null/undefined entryDate`);

    // Step 4: Fix entries with null/undefined entryDate
    console.log('\n🔧 Step 4: Setting entryDate to createdAt for entries with null/undefined entryDate...');
    let nullFixedCount = 0;
    let nullErrorCount = 0;

    for (const entry of entriesWithNullEntryDate) {
      try {
        await Entry.findByIdAndUpdate(entry._id, {
          entryDate: entry.createdAt
        });
        nullFixedCount++;
        console.log(`✅ Fixed entry ${entry._id} (${entry.receiptNumber || 'no receipt'})`);
      } catch (error) {
        nullErrorCount++;
        console.error(`❌ Error fixing entry ${entry._id}:`, error.message);
      }
    }

    console.log(`\n📊 Null fix summary: ${nullFixedCount} entries fixed, ${nullErrorCount} errors`);

    // Step 5: Verify the fix
    console.log('\n📊 Step 5: Verifying the fix...');
    const remainingWithoutEntryDate = await Entry.countDocuments({ entryDate: { $exists: false } });
    const remainingWithNullEntryDate = await Entry.countDocuments({
      $or: [
        { entryDate: null },
        { entryDate: undefined }
      ]
    });

    console.log(`\n📊 Verification results:`);
    console.log(`- Entries without entryDate field: ${remainingWithoutEntryDate}`);
    console.log(`- Entries with null/undefined entryDate: ${remainingWithNullEntryDate}`);

    // Step 6: Get overall statistics
    const totalEntries = await Entry.countDocuments();
    const entriesWithEntryDate = await Entry.countDocuments({ entryDate: { $exists: true, $ne: null, $ne: undefined } });

    console.log(`\n📊 Overall statistics:`);
    console.log(`- Total entries: ${totalEntries}`);
    console.log(`- Entries with valid entryDate: ${entriesWithEntryDate}`);
    console.log(`- Coverage: ${((entriesWithEntryDate / totalEntries) * 100).toFixed(2)}%`);

    if (remainingWithoutEntryDate === 0 && remainingWithNullEntryDate === 0) {
      console.log('\n✅ SUCCESS: All entries now have valid entryDate!');
    } else {
      console.log('\n⚠️ WARNING: Some entries still need fixing');
    }

  } catch (error) {
    console.error('❌ Error in fix script:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixPreviousEntries();
