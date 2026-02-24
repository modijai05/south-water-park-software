const EntryModel = require('../models/Entry.js').Entry;
const UserModel = require('../models/User.js').User;

/**
 * Script to backfill filledByFullName field for existing entries
 * This should be run once to populate the field for entries that don't have it
 */
async function backfillCashierNames() {
  try {
    console.log('Starting backfill of cashier names...');
    
    // Find all entries that don't have filledByFullName but have createdBy
    const entries = await EntryModel.find({ 
      filledByFullName: { $exists: false } 
    }).populate('createdBy', 'username fullName');
    
    console.log(`Found ${entries.length} entries to backfill`);
    
    for (const entry of entries) {
      const user = entry.createdBy;
      if (user) {
        const fullName = user.fullName || user.username;
        await EntryModel.findByIdAndUpdate(entry._id, { 
          filledByFullName: fullName 
        });
        console.log(`Updated entry ${entry._id} with cashier name: ${fullName}`);
      }
    }
    
    console.log('Backfill completed successfully!');
  } catch (error) {
    console.error('Error during backfill:', error);
  }
}

// Run backfill if this file is executed directly
if (require.main === module) {
  backfillCashierNames().then(() => {
    console.log('Script completed');
    process.exit(0);
  });
}

module.exports = { backfillCashierNames };
