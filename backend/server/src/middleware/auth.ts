import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user || !user.active) {
      res.status(401).json({ message: 'Invalid or inactive user' });
      return;
    }
    req.user = user;
    next();
  } catch {
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
