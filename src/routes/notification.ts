import { Router } from 'express';
import { param, query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate, commonValidations } from '../middleware/validation';
import * as notificationController from '../controllers/notificationController';

const router = Router();

// GET /api/v1/notifications - Get user's notifications
router.get('/', requireAuth, asyncHandler(notificationController.getNotifications));

// GET /api/v1/notifications/unread - Get unread notifications count
router.get('/unread', requireAuth, asyncHandler(notificationController.getUnreadCount));

// GET /api/v1/notifications/:id - Get single notification
router.get('/:id', requireAuth, [param('id').isMongoId().withMessage('Valid notification ID is required')], validate, asyncHandler(notificationController.getNotification));

// PUT /api/v1/notifications/:id/read - Mark notification as read
router.put('/:id/read', requireAuth, [param('id').isMongoId().withMessage('Valid notification ID is required')], validate, asyncHandler(notificationController.markAsRead));

// PUT /api/v1/notifications/:id/unread - Mark notification as unread
router.put('/:id/unread', requireAuth, [param('id').isMongoId().withMessage('Valid notification ID is required')], validate, asyncHandler(notificationController.markAsUnread));

// PUT /api/v1/notifications/:id/archive - Archive notification
router.put('/:id/archive', requireAuth, [param('id').isMongoId().withMessage('Valid notification ID is required')], validate, asyncHandler(notificationController.archiveNotification));

// PUT /api/v1/notifications/:id/unarchive - Unarchive notification
router.put('/:id/unarchive', requireAuth, [param('id').isMongoId().withMessage('Valid notification ID is required')], validate, asyncHandler(notificationController.unarchiveNotification));

// POST /api/v1/notifications/read-all - Mark all notifications as read
router.post('/read-all', requireAuth, asyncHandler(notificationController.markAllAsRead));

// DELETE /api/v1/notifications/:id - Delete notification
router.delete('/:id', requireAuth, [param('id').isMongoId().withMessage('Valid notification ID is required')], validate, asyncHandler(notificationController.deleteNotification));

// DELETE /api/v1/notifications/clear-read - Clear all read notifications
router.delete('/clear-read', requireAuth, asyncHandler(notificationController.clearReadNotifications));

// DELETE /api/v1/notifications/clear-archived - Clear all archived notifications
router.delete('/clear-archived', requireAuth, asyncHandler(notificationController.clearArchivedNotifications));

// Admin routes
// POST /api/v1/notifications/admin/broadcast - Send notification to all users (Admin only)
router.post('/admin/broadcast', requireRole('admin'), [
  query('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required and must be between 1 and 100 characters'),
  query('message').trim().isLength({ min: 1, max: 500 }).withMessage('Message is required and must be between 1 and 500 characters'),
  query('type').optional().isIn(['system', 'promotion']).withMessage('Type must be system or promotion'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level')
], validate, asyncHandler(notificationController.broadcastNotification));

// POST /api/v1/notifications/admin/send - Send notification to specific user (Admin only)
router.post('/admin/send', requireRole('admin'), [
  query('userId').isMongoId().withMessage('Valid user ID is required'),
  query('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required and must be between 1 and 100 characters'),
  query('message').trim().isLength({ min: 1, max: 500 }).withMessage('Message is required and must be between 1 and 500 characters'),
  query('type').optional().isIn(['system', 'promotion', 'security']).withMessage('Invalid notification type'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level')
], validate, asyncHandler(notificationController.sendNotificationToUser));

// GET /api/v1/notifications/admin/stats - Get notification statistics (Admin only)
router.get('/admin/stats', requireRole('admin'), asyncHandler(notificationController.getNotificationStats));

export default router;
