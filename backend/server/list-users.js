// List All Users
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('./src/models/User.js');

async function listUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/south-water-park');
    console.log('✅ Connected to MongoDB');

    // Get all users
    const users = await User.find({});
    
    console.log(`📋 Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`   - ${user.username} (${user.role}) - Active: ${user.active}`);
      console.log(`     Password: ${user.password.substring(0, 20)}...`);
    });

  } catch (error) {
    console.error('❌ Error listing users:', error);
  } finally {
    await mongoose.disconnect();
  }
}

listUsers();
