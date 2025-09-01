import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { User } from '../models/User';
import { logger } from '../config/logger';
import { createUnauthorizedError, createForbiddenError } from './errorHandler';
import { AuthenticatedRequest, IJwtPayload } from '../types';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createUnauthorizedError('Access token required', 'TOKEN_MISSING');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw createUnauthorizedError('Access token required', 'TOKEN_MISSING');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as IJwtPayload;
    
    // Check if user exists and is active
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      throw createUnauthorizedError('User not found', 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw createForbiddenError('User account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    // Check if user is locked
    if (user.isLocked) {
      throw createForbiddenError('User account is locked', 'ACCOUNT_LOCKED');
    }

    // Attach user to request
    req.user = user;
    
    // Log successful authentication
    logger.info('User authenticated successfully:', {
      userId: user._id,
      email: user.email,
      role: user.role,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('JWT verification failed:', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return next(createUnauthorizedError('Invalid token', 'INVALID_TOKEN'));
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('JWT token expired:', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return next(createUnauthorizedError('Token expired', 'TOKEN_EXPIRED'));
    }

    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createUnauthorizedError('Authentication required', 'AUTH_REQUIRED'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt:', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });
      
      return next(createForbiddenError(
        'Insufficient permissions to access this resource',
        'INSUFFICIENT_PERMISSIONS'
      ));
    }

    next();
  };
};

export const requireAuth = authenticate;
export const requireRole = authorize;
export const requireAdmin = authorize('admin', 'super_admin');
export const requireSuperAdmin = authorize('super_admin');

