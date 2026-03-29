// Create Test User for Analytics Testing
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('./src/models/User.js');

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/south-water-park');
    console.log('✅ Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ username: 'testuser' });
    if (existingUser) {
      console.log('✅ Test user already exists');
      await mongoose.disconnect();
      return;
    }

    // Create test user
    const testUser = new User({
      username: 'testuser',
      password: 'test123', // Plain text as per auth.js
      email: 'test@example.com',
      role: 'admin',
      isActive: true
    });

    await testUser.save();
    console.log('✅ Test user created successfully');
    console.log('   Username: testuser');
    console.log('   Password: test123');
    console.log('   Role: admin');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createTestUser();
