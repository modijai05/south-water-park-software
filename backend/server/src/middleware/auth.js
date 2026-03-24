const jwt = require('jsonwebtoken');
const { User } = require('../models/User.js');

const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

const authenticate = async (req, res, next) => {
  try {
    // Set CORS headers for all auth responses
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      console.log('Auth: No token provided');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    console.log('Auth: Token provided, verifying...');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Auth: Token decoded for userId:', decoded.userId);
    
    // Handle fallback mode when database is not connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log('Auth: Database not connected, using fallback authentication');
      
      // For fallback users, create a mock user object
      if (decoded.userId === 'fallback-admin') {
        req.user = {
          _id: 'fallback-admin',
          username: 'admin1',
          fullName: 'Admin User',
          role: 'admin',
          active: true
        };
        console.log('Auth: Fallback admin authenticated successfully');
        return next();
      }
      
      if (decoded.userId === 'fallback-staff') {
        req.user = {
          _id: 'fallback-staff',
          username: 'staff1',
          fullName: 'Staff User',
          role: 'staff',
          active: true
        };
        console.log('Auth: Fallback staff authenticated successfully');
        return next();
      }
      
      console.log('Auth: Invalid fallback userId:', decoded.userId);
      return res.status(401).json({ message: 'Invalid token - user not found' });
    }
    
    // Handle fallback users even when database is connected
    if (decoded.userId === 'fallback-admin') {
      req.user = {
        _id: 'fallback-admin',
        username: 'admin1',
        fullName: 'Admin User',
        role: 'admin',
        active: true
      };
      console.log('Auth: Fallback admin authenticated successfully (database connected)');
      return next();
    }
    
    if (decoded.userId === 'fallback-staff') {
      req.user = {
        _id: 'fallback-staff',
        username: 'staff1',
        fullName: 'Staff User',
        role: 'staff',
        active: true
      };
      console.log('Auth: Fallback staff authenticated successfully (database connected)');
      return next();
    }
    
    // Normal database authentication
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('Auth: User not found for userId:', decoded.userId);
      return res.status(401).json({ message: 'Invalid token - user not found' });
    }
    
    if (!user.active) {
      console.log('Auth: User is inactive for userId:', decoded.userId);
      return res.status(401).json({ message: 'Account is inactive' });
    }
    
    console.log('Auth: User authenticated successfully for userId:', decoded.userId, 'username:', user.username);
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth: Authentication error:', error);
    console.error('Auth: Error name:', error.name);
    console.error('Auth: Error message:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      console.log('Auth: Token expired for user');
      return res.status(401).json({ 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
        requiresReauth: true
      });
    } else if (error.name === 'JsonWebTokenError') {
      console.log('Auth: Invalid token format');
      return res.status(401).json({ 
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else {
      console.log('Auth: General authentication failure');
      return res.status(401).json({ 
        message: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }
  }
};

const requireAdmin = (req, res, next) => {
  // Set CORS headers for admin responses
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    console.log('Auth: Admin access required, user role:', req.user.role);
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  console.log('Auth: Admin access granted');
  next();
};

module.exports = { authenticate, requireAdmin };
