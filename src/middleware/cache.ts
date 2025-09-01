import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// Basic cache middleware
export const cache = (req: Request, res: Response, next: NextFunction) => {
  // Set cache headers for GET requests
  if (req.method === 'GET') {
    // Cache for 5 minutes
    res.set('Cache-Control', 'public, max-age=300');
  }
  
  next();
};

// Cache middleware with custom duration
export const cacheWithDuration = (duration: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=${duration}`);
    }
    next();
  };
};

// No cache middleware
export const noCache = (req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};
