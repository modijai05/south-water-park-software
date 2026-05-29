const { Router } = require('express');
const { auth: firebaseAuth } = require('../config/firebase.js');
const { User } = require('../models/User.js');
const jwt = require('jsonwebtoken');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

// OPTIONS handler for CORS preflight
router.options('/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.status(204).end();
});

/**
 * POST /api/firebase-auth/register
 * Register a new user with Firebase Authentication
 */
router.post('/register', async (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    const { email, password, username, fullName, role = 'staff' } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ message: 'Email, password, and username are required' });
    }

    if (!firebaseAuth) {
      return res.status(500).json({ message: 'Firebase Authentication is not configured' });
    }

    // Check if user already exists in MongoDB
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user in Firebase Authentication
    const userRecord = await firebaseAuth.createUser({
      email,
      password,
      displayName: fullName || username,
    });

    console.log('✅ Firebase user created:', userRecord.uid);

    // Create corresponding user in MongoDB
    const newUser = new User({
      username,
      email,
      fullName: fullName || username,
      password, // Will be hashed by User model
      role,
      firebaseUid: userRecord.uid,
      active: true,
    });

    await newUser.save();

    console.log('✅ MongoDB user created:', newUser.username);

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, username: newUser.username, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        active: newUser.active,
        firebaseUid: userRecord.uid,
      },
    });
  } catch (error) {
    console.error('❌ Firebase registration error:', error);
    
    // Handle Firebase specific errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ message: 'Email already exists in Firebase' });
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ message: 'Password is too weak' });
    }

    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

/**
 * POST /api/firebase-auth/login
 * Login with Firebase Authentication token
 */
router.post('/login', async (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID token is required' });
    }

    if (!firebaseAuth) {
      return res.status(500).json({ message: 'Firebase Authentication is not configured' });
    }

    // Verify Firebase ID token
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;

    console.log('✅ Firebase token verified for user:', firebaseUid);

    // Find user in MongoDB by Firebase UID
    let user = await User.findOne({ firebaseUid });

    // If user doesn't exist in MongoDB but exists in Firebase, create MongoDB user
    if (!user) {
      const firebaseUser = await firebaseAuth.getUser(firebaseUid);
      
      user = new User({
        username: firebaseUser.email?.split('@')[0] || firebaseUser.uid,
        email: firebaseUser.email,
        fullName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
        password: Math.random().toString(36).slice(-8), // Random password for Firebase users
        role: 'staff',
        firebaseUid: firebaseUser.uid,
        active: true,
      });

      await user.save();
      console.log('✅ Created MongoDB user for Firebase user:', user.username);
    }

    if (!user.active) {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        active: user.active,
        firebaseUid: user.firebaseUid,
      },
    });
  } catch (error) {
    console.error('❌ Firebase login error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'Firebase ID token has expired' });
    }
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ message: 'Firebase ID token has been revoked' });
    }
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ message: 'Invalid Firebase ID token' });
    }

    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

/**
 * POST /api/firebase-auth/reset-password
 * Send password reset email via Firebase
 */
router.post('/reset-password', async (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!firebaseAuth) {
      return res.status(500).json({ message: 'Firebase Authentication is not configured' });
    }

    const resetLink = await firebaseAuth.generatePasswordResetLink(email);
    
    console.log('✅ Password reset link generated for:', email);

    // In production, you would send this link via email
    // For now, return it in the response (for development)
    res.json({
      message: 'Password reset link generated',
      resetLink, // Remove this in production
      note: 'In production, this link would be sent via email',
    });
  } catch (error) {
    console.error('❌ Password reset error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(500).json({ message: 'Password reset failed', error: error.message });
  }
});

/**
 * DELETE /api/firebase-auth/user
 * Delete user from Firebase and MongoDB
 */
router.delete('/user', async (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ message: 'Firebase UID is required' });
    }

    if (!firebaseAuth) {
      return res.status(500).json({ message: 'Firebase Authentication is not configured' });
    }

    // Delete from Firebase
    await firebaseAuth.deleteUser(firebaseUid);
    console.log('✅ Firebase user deleted:', firebaseUid);

    // Delete from MongoDB
    const deletedUser = await User.findOneAndDelete({ firebaseUid });
    
    if (deletedUser) {
      console.log('✅ MongoDB user deleted:', deletedUser.username);
    }

    res.json({
      message: 'User deleted successfully',
      deleted: !!deletedUser,
    });
  } catch (error) {
    console.error('❌ User deletion error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ message: 'User not found in Firebase' });
    }

    res.status(500).json({ message: 'User deletion failed', error: error.message });
  }
});

module.exports = router;
