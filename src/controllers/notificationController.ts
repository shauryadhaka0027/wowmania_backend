import { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const getNotifications = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { page = 1, limit = 20, type, isRead, isArchived, priority } = req.query;

  const options = {
    page: Number(page),
    limit: Number(limit),
    type: type as string,
    isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
    isArchived: isArchived === 'true' ? true : isArchived === 'false' ? false : undefined,
    priority: priority as string
  };

  const notifications = await (Notification as any).findByUser(userId, options);

  res.json({
    success: true,
    data: { notifications },
    message: 'Notifications retrieved successfully'
  });
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const count = await (Notification as any).getUnreadCount(userId);

  res.json({
    success: true,
    data: { count },
    message: 'Unread count retrieved successfully'
  });
};

export const getNotification = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const notification = await Notification.findOne({ _id: id, userId });
  if (!notification) {
    throw createNotFoundError('Notification not found');
  }

  res.json({
    success: true,
    data: { notification },
    message: 'Notification retrieved successfully'
  });
};

export const markAsRead = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const notification = await Notification.findOne({ _id: id, userId });
  if (!notification) {
    throw createNotFoundError('Notification not found');
  }

  await notification.markAsRead();

  res.json({
    success: true,
    data: { notification },
    message: 'Notification marked as read'
  });
};

export const markAsUnread = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const notification = await Notification.findOne({ _id: id, userId });
  if (!notification) {
    throw createNotFoundError('Notification not found');
  }

  await notification.markAsUnread();

  res.json({
    success: true,
    data: { notification },
    message: 'Notification marked as unread'
  });
};

export const archiveNotification = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const notification = await Notification.findOne({ _id: id, userId });
  if (!notification) {
    throw createNotFoundError('Notification not found');
  }

  await notification.archive();

  res.json({
    success: true,
    data: { notification },
    message: 'Notification archived'
  });
};

export const unarchiveNotification = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const notification = await Notification.findOne({ _id: id, userId });
  if (!notification) {
    throw createNotFoundError('Notification not found');
  }

  await notification.unarchive();

  res.json({
    success: true,
    data: { notification },
    message: 'Notification unarchived'
  });
};

export const markAllAsRead = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  await (Notification as any).markAllAsRead(userId);

  logger.info('All notifications marked as read', { userId });

  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
};

export const deleteNotification = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const notification = await Notification.findOne({ _id: id, userId });
  if (!notification) {
    throw createNotFoundError('Notification not found');
  }

  await Notification.findByIdAndDelete(id);

  logger.info('Notification deleted', { notificationId: id, userId });

  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
};

export const clearReadNotifications = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const result = await Notification.deleteMany({ userId, isRead: true });

  logger.info('Read notifications cleared', { 
    userId, 
    deletedCount: result.deletedCount 
  });

  res.json({
    success: true,
    data: { deletedCount: result.deletedCount },
    message: 'Read notifications cleared successfully'
  });
};

export const clearArchivedNotifications = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const result = await Notification.deleteMany({ userId, isArchived: true });

  logger.info('Archived notifications cleared', { 
    userId, 
    deletedCount: result.deletedCount 
  });

  res.json({
    success: true,
    data: { deletedCount: result.deletedCount },
    message: 'Archived notifications cleared successfully'
  });
};

// Admin functions
export const broadcastNotification = async (req: Request, res: Response) => {
  const { title, message, type = 'system', priority = 'medium', data } = req.body;

  if (!title || !message) {
    throw createValidationError('Title and message are required');
  }

  // TODO: Get all user IDs and send notifications
  // For now, get all active users
  const users = await User.find({ isActive: true }).select('_id');
  const userIds = users.map(user => user._id);

  const notifications = [];
  for (const userId of userIds) {
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      data,
      priority
    });
    notifications.push(notification);
  }

  await Notification.insertMany(notifications);

  logger.info('Broadcast notification sent', { 
    sentBy: (req as any).user.id,
    recipientCount: userIds.length,
    title,
    type 
  });

  res.json({
    success: true,
    data: { 
      sentCount: userIds.length,
      notification: {
        title,
        message,
        type,
        priority
      }
    },
    message: `Notification broadcasted to ${userIds.length} users`
  });
};

export const sendNotificationToUser = async (req: Request, res: Response) => {
  const { userId, title, message, type = 'system', priority = 'medium', data } = req.body;

  if (!userId || !title || !message) {
    throw createValidationError('User ID, title, and message are required');
  }

  // Validate user exists
  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  const notification = new Notification({
    userId,
    type,
    title,
    message,
    data,
    priority
  });

  await notification.save();

  logger.info('Notification sent to user', { 
    sentBy: (req as any).user.id,
    recipientId: userId,
    title,
    type 
  });

  res.json({
    success: true,
    data: { notification },
    message: 'Notification sent successfully'
  });
};

export const getNotificationStats = async (req: Request, res: Response) => {
  const { period = '30' } = req.query;

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - Number(period));

  const stats = await Notification.aggregate([
    {
      $match: {
        createdAt: { $gte: daysAgo }
      }
    },
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        unreadCount: {
          $sum: { $cond: ['$isRead', 0, 1] }
        },
        typeDistribution: {
          $push: '$type'
        },
        priorityDistribution: {
          $push: '$priority'
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalNotifications: 0,
    unreadCount: 0,
    typeDistribution: [],
    priorityDistribution: []
  };

  // Calculate type distribution
  const typeCounts: any = {};
  result.typeDistribution.forEach((type: string) => {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  // Calculate priority distribution
  const priorityCounts: any = {};
  result.priorityDistribution.forEach((priority: string) => {
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      stats: {
        totalNotifications: result.totalNotifications,
        unreadCount: result.unreadCount,
        typeDistribution: typeCounts,
        priorityDistribution: priorityCounts,
        period: Number(period)
      }
    },
    message: 'Notification statistics retrieved successfully'
  });
};

