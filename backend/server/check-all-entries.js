const mongoose = require('mongoose');
const { Entry } = require('./src/models/Entry.js');
require('dotenv').config();

async function checkAllEntries() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    
    const totalEntries = await Entry.countDocuments();
    const entriesWithoutDiscounts = await Entry.countDocuments({
      $or: [
        { baseAmount: { $exists: false } },
        { kidDiscount: { $exists: false } },
        { additionalDiscount: { $exists: false } }
      ]
    });
    
    console.log(`Total entries in database: ${totalEntries}`);
    console.log(`Entries missing discount fields: ${entriesWithoutDiscounts}`);
    
    if (entriesWithoutDiscounts > 0) {
      console.log('Running discount fix on all entries...');
      const { spawn } = require('child_process');
      const fixProcess = spawn('node', ['fix-discount-data.js'], { stdio: 'inherit' });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAllEntries();
