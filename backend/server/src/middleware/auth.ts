import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.js';

type UserDocument = ReturnType<typeof User.findById> extends Promise<infer T> ? T : never;

interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  user?: any;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      console.log('Auth: No token provided');
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    
    console.log('Auth: Token provided, verifying...');
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
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
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
};

export type { AuthenticatedRequest as AuthRequest };
