const { Entry } = require('../models/Entry.js');

/**
 * Generates a unique receipt number in format: SWP-YYYYMMDD-NNNN
 * SWP = South Water Park
 * YYYYMMDD = Current date
 * NNNN = Sequential 4-digit number for the day
 */
async function generateUniqueReceiptNumber() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
                  (today.getMonth() + 1).toString().padStart(2, '0') +
                  today.getDate().toString().padStart(2, '0');
  
  const prefix = `SWP-${dateStr}`;
  
  try {
    // Find the highest receipt number for today
    const lastEntry = await Entry.findOne({
      receiptNumber: { $regex: `^${prefix}-\\d{4}$` }
    }).sort({ receiptNumber: -1 });
    
    let sequence = 1;
    
    if (lastEntry && lastEntry.receiptNumber) {
      // Extract the sequence number from the last receipt number
      const lastSequence = parseInt(lastEntry.receiptNumber.split('-')[2]);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
    
    // Format the sequence as 4-digit number with leading zeros
    const sequenceStr = sequence.toString().padStart(4, '0');
    
    return `${prefix}-${sequenceStr}`;
  } catch (error) {
    console.error('Error generating receipt number:', error);
    // Fallback to timestamp-based receipt number
    const timestamp = today.getTime().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  }
}

/**
 * Generates a receipt number for an existing entry (for receipts generated after entry creation)
 */
async function generateReceiptNumberForExistingEntry() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
                  (today.getMonth() + 1).toString().padStart(2, '0') +
                  today.getDate().toString().padStart(2, '0');
  
  const prefix = `SWP-${dateStr}`;
  
  try {
    // Find the highest receipt number for today
    const lastEntry = await Entry.findOne({
      receiptNumber: { $regex: `^${prefix}-\\d{4}$` }
    }).sort({ receiptNumber: -1 });
    
    let sequence = 1;
    
    if (lastEntry && lastEntry.receiptNumber) {
      // Extract the sequence number from the last receipt number
      const lastSequence = parseInt(lastEntry.receiptNumber.split('-')[2]);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
    
    // Format the sequence as 4-digit number with leading zeros
    const sequenceStr = sequence.toString().padStart(4, '0');
    
    return `${prefix}-${sequenceStr}`;
  } catch (error) {
    console.error('Error generating receipt number for existing entry:', error);
    // Fallback to timestamp-based receipt number
    const timestamp = today.getTime().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  }
}

module.exports = {
  generateUniqueReceiptNumber,
  generateReceiptNumberForExistingEntry
};
