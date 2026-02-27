import { Request, Response, NextFunction } from 'express';

interface CustomError extends Error {
  status?: number;
  code?: number;
  errors?: any;
  keyValue?: any;
  name: string;
}

export const errorHandler = (err: CustomError, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e: any) => e.message);
    return res.status(400).json({
      message: 'Validation Error',
      errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      message: `${field} already exists`
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
};
