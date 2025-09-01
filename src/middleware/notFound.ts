import { Request, Response } from 'express';
import { logger } from '../config/logger';

export const notFound = (req: Request, res: Response) => {
  const error = `Route ${req.originalUrl} not found`;
  
  logger.warn('Route not found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
      details: `The requested route ${req.method} ${req.originalUrl} does not exist`
    },
    timestamp: new Date().toISOString()
  });
};


