const jwt = require('jsonwebtoken');
const { User } = require('../models/User.js');

const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      console.log('Auth: No token provided');
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    
    console.log('Auth: Token provided, verifying...');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Auth: Token decoded for userId:', decoded.userId);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('Auth: User not found');
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
    
    if (!user.active) {
      console.log('Auth: User is inactive');
      res.status(401).json({ message: 'Account is inactive' });
      return;
    }
    
    console.log('Auth: User authenticated successfully');
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth: Authentication error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
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
