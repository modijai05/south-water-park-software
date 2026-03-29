// Check Test User in Database
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('./src/models/User.js');

async function checkUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/south-water-park');
    console.log('✅ Connected to MongoDB');

    // Find test user
    const user = await User.findOne({ username: 'testuser' });
    
    if (user) {
      console.log('✅ Test user found:');
      console.log('   Username:', user.username);
      console.log('   Password:', user.password);
      console.log('   Role:', user.role);
      console.log('   Active:', user.isActive);
      console.log('   ID:', user._id);
    } else {
      console.log('❌ Test user not found');
      
      // List all users
      const allUsers = await User.find({});
      console.log('📋 All users in database:');
      allUsers.forEach(u => {
        console.log(`   - ${u.username} (${u.role})`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking user:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkUser();
