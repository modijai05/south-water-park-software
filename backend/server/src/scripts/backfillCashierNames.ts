import { Entry } from '../models/Entry.js';
import { User } from '../models/User.js';

/**
 * Script to backfill filledByFullName field for existing entries
 * This should be run once to populate the field for entries that don't have it
 */
async function backfillCashierNames() {
  try {
    console.log('Starting backfill of cashier names...');
    
    // Find all entries that don't have filledByFullName but have createdBy
    const entries = await Entry.find({ 
      filledByFullName: { $exists: false } 
    }).populate('createdBy', 'username fullName');
    
    console.log(`Found ${entries.length} entries to backfill`);
    
    for (const entry of entries) {
      const user = entry.createdBy as any;
      if (user) {
        const fullName = user.fullName || user.username;
        await Entry.findByIdAndUpdate(entry._id, { 
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
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillCashierNames().then(() => {
    console.log('Script completed');
    (globalThis as any).process?.exit(0);
  });
}

export { backfillCashierNames };
