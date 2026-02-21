import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

export interface AuthRequest extends Request {
  user?: IUser;
  // Express Request properties
  query: any;
  params: any;
  body: any;
  headers: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      console.log('Auth: No token provided');
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    
    console.log('Auth: Token provided, verifying...');
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    console.log('Auth: Token decoded for userId:', decoded.userId);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('Auth: User not found for userId:', decoded.userId);
      res.status(401).json({ message: 'Invalid or inactive user' });
      return;
    }
    
    if (!user.active) {
      console.log('Auth: User is inactive:', user.username);
      res.status(401).json({ message: 'Invalid or inactive user' });
      return;
    }
    
    console.log('Auth: User authenticated:', user.username, 'Role:', user.role);
    req.user = user;
    next();
  } catch (error) {
    console.log('Auth: Token verification failed:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
};
