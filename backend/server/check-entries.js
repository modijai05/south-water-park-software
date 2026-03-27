const mongoose = require('mongoose');

async function checkEntries() {
  try {
    await mongoose.connect('mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority');
    
    const db = mongoose.connection.db;
    const entries = await db.collection('entries').find().toArray();
    
    console.log('📊 Total entries in database:', entries.length);
    entries.forEach((entry, i) => {
      console.log(`${i+1}. ${entry.name} - ${entry.ticketType} - ₹${entry.finalAmount} - ${entry.receiptNumber}`);
    });
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkEntries();
