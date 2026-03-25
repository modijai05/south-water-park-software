const EntryModel = require('../models/Entry.js').Entry;
const UserModel = require('../models/User.js').User;

/**
 * Script to backfill filledByFullName field for existing entries
 * This should be run once to populate the field for entries that don't have it
 */
async function backfillCashierNames() {
  try {
    
    // Find entries to backfill
    const entries = await EntryModel.find({ 
      filledByFullName: { $exists: false } 
    }).populate('createdBy', 'username fullName');
    
    for (const entry of entries) {
      const user = entry.createdBy;
      if (user) {
        const fullName = user.fullName || user.username;
        await EntryModel.findByIdAndUpdate(entry._id, { 
          filledByFullName: fullName 
        });
      }
    }
    
    // Backfill completed
  } catch (error) {
  }
}

// Run backfill if this file is executed directly
if (require.main === module) {
  backfillCashierNames().then(() => {
    process.exit(0);
  }).catch((error) => {
    process.exit(1);
  });
}

module.exports = { backfillCashierNames };
