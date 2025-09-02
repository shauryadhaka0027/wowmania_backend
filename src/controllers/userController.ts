import { Request, Response } from 'express';
import { User } from '../models/User';
import { createNotFoundError, createValidationError, createForbiddenError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const getAllUsers = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search, role, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const filter: any = {};
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  if (role) filter.role = role;
  if (status) filter.isActive = status === 'active';

  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    },
    message: 'Users retrieved successfully'
  });
};

export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password');
  if (!user) {
    throw createNotFoundError('User not found');
  }

  res.json({
    success: true,
    data: { user },
    message: 'User retrieved successfully'
  });
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { firstName, lastName, phone, dateOfBirth, gender } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  // Update allowed fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phone) user.phone = phone;
  if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
  if (gender) user.gender = gender;

  await user.save();

  logger.info('User profile updated', { userId });

  res.json({
    success: true,
    data: { user },
    message: 'Profile updated successfully'
  });
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, phone, role, isActive } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  // Update allowed fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phone) user.phone = phone;
  if (role) user.role = role;
  if (typeof isActive === 'boolean') user.isActive = isActive;

  await user.save();

  logger.info('User updated by admin', { userId: id, updatedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { user },
    message: 'User updated successfully'
  });
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  // Soft delete
  user.isActive = false;
  (user as any).deletedAt = new Date();
  
  await user.save();

  logger.info('User soft deleted', { userId: id, deletedBy: (req as any).user.id });

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
};

export const addAddress = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const addressData = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  await (user as any).addAddress(addressData);

  res.json({
    success: true,
    data: { addresses: user.addresses },
    message: 'Address added successfully'
  });
};

export const updateAddress = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { addressId } = req.params;
  const addressData = req.body;

  if (!addressId) {
    throw createValidationError('Address ID is required');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  await (user as any).updateAddress(addressId, addressData);

  res.json({
    success: true,
    data: { addresses: user.addresses },
    message: 'Address updated successfully'
  });
};

export const removeAddress = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { addressId } = req.params;

  if (!addressId) {
    throw createValidationError('Address ID is required');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  await user.removeAddress(addressId);

  res.json({
    success: true,
    data: { addresses: user.addresses },
    message: 'Address removed successfully'
  });
};

export const setDefaultAddress = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { addressId } = req.params;

  if (!addressId) {
    throw createValidationError('Address ID is required');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  await user.setDefaultAddress(addressId);

  res.json({
    success: true,
    data: { addresses: user.addresses },
    message: 'Default address set successfully'
  });
};

export const updatePreferences = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const preferences = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  user.preferences = { ...user.preferences, ...preferences };
  await user.save();

  res.json({
    success: true,
    data: { preferences: user.preferences },
    message: 'Preferences updated successfully'
  });
};

export const searchUsers = async (req: Request, res: Response) => {
  const { q, page = 1, limit = 10 } = req.query;

  if (!q) {
    throw createValidationError('Search query is required');
  }

  const filter = {
    $or: [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } }
    ],
    isActive: true
  };

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('firstName lastName email avatar')
      .sort({ firstName: 1, lastName: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    },
    message: 'Users search completed'
  });
};
