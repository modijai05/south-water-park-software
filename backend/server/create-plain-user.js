// Create Test User with Plain Text Password for Testing
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('./src/models/User.js');

async function createPlainUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/south-water-park');
    console.log('✅ Connected to MongoDB');

    // Delete existing test user
    await User.deleteOne({ username: 'testuser' });

    // Create test user with plain text password (bypass hashing)
    const testUser = new User({
      username: 'testuser',
      password: 'test123', // This will be hashed by pre-save hook
      email: 'test@example.com',
      role: 'admin',
      active: true
    });

    // Bypass the pre-save hook to store plain text password
    testUser.password = 'test123';
    await testUser.save({ validateBeforeSave: false });
    
    console.log('✅ Plain text test user created successfully');
    console.log('   Username: testuser');
    console.log('   Password: test123 (plain text)');
    console.log('   Role: admin');

  } catch (error) {
    console.error('❌ Error creating plain user:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createPlainUser();
