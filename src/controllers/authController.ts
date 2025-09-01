import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { createValidationError, createUnauthorizedError, createNotFoundError } from '../middleware/errorHandler';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { getRedisClient } from '../config/redis';

export const register = async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createValidationError('User with this email already exists');
  }

  // Create new user
  const user = new User({
    email,
    password,
    firstName,
    lastName,
    phone
  });

  await user.save();

  // Generate tokens
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  // Store refresh token in Redis
  const redis = getRedisClient();
  await redis.setex(`refresh_token:${user._id}`, 7 * 24 * 60 * 60, refreshToken); // 7 days

  logger.info('User registered successfully', { userId: user._id, email });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      accessToken,
      refreshToken
    },
    message: 'User registered successfully'
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw createUnauthorizedError('Invalid credentials');
  }

  // Check if account is locked
  if (user.isLocked) {
    throw createUnauthorizedError('Account is locked. Please contact support.');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    await user.incLoginAttempts();
    throw createUnauthorizedError('Invalid credentials');
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  // Generate tokens
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  // Store refresh token in Redis
  const redis = getRedisClient();
  await redis.setex(`refresh_token:${user._id}`, 7 * 24 * 60 * 60, refreshToken);

  logger.info('User logged in successfully', { userId: user._id, email });

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      accessToken,
      refreshToken
    },
    message: 'Login successful'
  });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw createValidationError('Refresh token is required');
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
    const userId = decoded.userId;

    // Check if refresh token exists in Redis
    const redis = getRedisClient();
    const storedToken = await redis.get(`refresh_token:${userId}`);
    
    if (!storedToken || storedToken !== refreshToken) {
      throw createUnauthorizedError('Invalid refresh token');
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw createNotFoundError('User not found');
    }

    // Generate new tokens
    const newAccessToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    // Update refresh token in Redis
    await redis.setex(`refresh_token:${userId}`, 7 * 24 * 60 * 60, newRefreshToken);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      },
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createUnauthorizedError('Invalid refresh token');
    }
    throw error;
  }
};

export const logout = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  // Remove refresh token from Redis
  const redis = getRedisClient();
  await redis.del(`refresh_token:${userId}`);

  logger.info('User logged out', { userId });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if user exists or not for security
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  }

  // Generate reset token
  const resetToken = jwt.sign(
    { userId: user._id },
    config.jwt.resetSecret,
    { expiresIn: '1h' }
  );

  // Store reset token in Redis
  const redis = getRedisClient();
  await redis.setex(`reset_token:${user._id}`, 3600, resetToken); // 1 hour

  // TODO: Send email with reset link
  logger.info('Password reset requested', { userId: user._id, email });

  res.json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent'
  });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  try {
    // Verify reset token
    const decoded = jwt.verify(token, config.jwt.resetSecret) as any;
    const userId = decoded.userId;

    // Check if reset token exists in Redis
    const redis = getRedisClient();
    const storedToken = await redis.get(`reset_token:${userId}`);
    
    if (!storedToken || storedToken !== token) {
      throw createUnauthorizedError('Invalid or expired reset token');
    }

    // Update password
    const user = await User.findById(userId);
    if (!user) {
      throw createNotFoundError('User not found');
    }

    user.password = newPassword;
    await user.save();

    // Remove reset token from Redis
    await redis.del(`reset_token:${userId}`);

    logger.info('Password reset successfully', { userId });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createUnauthorizedError('Invalid or expired reset token');
    }
    throw error;
  }
};

export const getMe = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw createNotFoundError('User not found');
  }

  res.json({
    success: true,
    data: { user },
    message: 'User profile retrieved successfully'
  });
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    // Verify email verification token
    const decoded = jwt.verify(token, config.jwt.emailSecret) as any;
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      throw createNotFoundError('User not found');
    }

    if (user.isEmailVerified) {
      return res.json({
        success: true,
        message: 'Email already verified'
      });
    }

    user.isEmailVerified = true;
    await user.save();

    logger.info('Email verified successfully', { userId });

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createUnauthorizedError('Invalid or expired verification token');
    }
    throw error;
  }
};
