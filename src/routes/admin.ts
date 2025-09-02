import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import { validate, commonValidations, validateRequest } from '../middleware/validation';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Category } from '../models/Category';
import { Review } from '../models/Review';
import { Notification } from '../models/Notification';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

const router = Router();

// Dashboard Statistics
// GET /api/v1/admin/dashboard - Get dashboard statistics
router.get('/dashboard', requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const [
    totalUsers,
    totalProducts,
    totalOrders,
    totalRevenue,
    pendingOrders,
    lowStockProducts,
    recentOrders,
    topProducts,
    userGrowth,
    revenueGrowth
  ] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),
    Order.countDocuments({ status: 'pending' }),
    Product.countDocuments({ stockQuantity: { $lt: 10 } }),
    Order.find()
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Product.find({ isActive: true })
      .sort({ 'ratings.averageRating': -1, 'ratings.totalReviews': -1 })
      .limit(5)
      .lean(),
    User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]),
    Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$total' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ])
  ]);

  const stats = {
    overview: {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      pendingOrders,
      lowStockProducts
    },
    recent: {
      orders: recentOrders,
      topProducts
    },
    growth: {
      users: userGrowth,
      revenue: revenueGrowth
    }
  };

  res.json({
    success: true,
    data: stats
  });
}));

// User Management
// GET /api/v1/admin/users - Get all users with filtering
router.get('/users', requireRole('admin'),
  validateRequest([
    ...commonValidations.pagination,
    ...commonValidations.searchQuery,
    ...commonValidations.sort
  ]),
  validate,
  asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    search,
    role,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

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

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean(),
    User.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / parseInt(limit as string));

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages,
        hasNext: parseInt(page as string) < totalPages,
        hasPrev: parseInt(page as string) > 1
      }
    }
  });
}));

// PUT /api/v1/admin/users/:id/status - Update user status
router.put('/users/:id/status', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid user ID is required'),
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
], validate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await User.findByIdAndUpdate(
    id,
    { isActive },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    throw createNotFoundError('User not found');
  }

  logger.info(`User status updated: ${user._id} to ${isActive} by admin: ${(req as any).user.id}`);

  res.json({
    success: true,
    data: user,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
  });
}));

// PUT /api/v1/admin/users/:id/role - Update user role
router.put('/users/:id/role', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid user ID is required'),
  body('role').isIn(['customer', 'admin', 'super_admin']).withMessage('Invalid role')
], validate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  const user = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    throw createNotFoundError('User not found');
  }

  logger.info(`User role updated: ${user._id} to ${role} by admin: ${(req as any).user.id}`);

  res.json({
    success: true,
    data: user,
    message: 'User role updated successfully'
  });
}));

// Inventory Management
// GET /api/v1/admin/inventory - Get inventory overview
router.get('/inventory', requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const [
    totalProducts,
    lowStockProducts,
    outOfStockProducts,
    productsNeedingRestock,
    inventoryValue
  ] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, stockQuantity: { $lt: 10, $gt: 0 } }),
    Product.countDocuments({ isActive: true, stockQuantity: 0 }),
    Product.find({ isActive: true, stockQuantity: { $lt: 10 } })
      .select('name sku stockQuantity price')
      .sort({ stockQuantity: 1 })
      .limit(10)
      .lean(),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$price', '$stockQuantity'] } }
        }
      }
    ])
  ]);

  const inventory = {
    overview: {
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      inventoryValue: inventoryValue[0]?.totalValue || 0
    },
    needsRestock: productsNeedingRestock
  };

  res.json({
    success: true,
    data: inventory
  });
}));

// POST /api/v1/admin/inventory/bulk-update - Bulk update inventory
router.post('/inventory/bulk-update', requireRole('admin'), [
  body('updates').isArray().withMessage('Updates must be an array'),
  body('updates.*.productId').isMongoId().withMessage('Valid product ID is required'),
  body('updates.*.stockQuantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer')
], validate, asyncHandler(async (req: Request, res: Response) => {
  const { updates } = req.body;

  const bulkOps = updates.map((update: any) => ({
    updateOne: {
      filter: { _id: update.productId },
      update: { stockQuantity: update.stockQuantity }
    }
  }));

  const result = await Product.bulkWrite(bulkOps);

  logger.info(`Bulk inventory update: ${result.modifiedCount} products updated by admin: ${(req as any).user.id}`);

  res.json({
    success: true,
    data: { modifiedCount: result.modifiedCount },
    message: `${result.modifiedCount} products updated successfully`
  });
}));

// Analytics
// GET /api/v1/admin/analytics/sales - Get sales analytics
router.get('/analytics/sales', requireRole('admin'), [
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Invalid period'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date')
], validate, asyncHandler(async (req: Request, res: Response) => {
  const { period = 'monthly', startDate, endDate } = req.query;

  let dateFilter: any = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
  }

  const salesData = await Order.aggregate([
    { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        totalSales: { $sum: '$total' },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: '$total' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  res.json({
    success: true,
    data: {
      period,
      salesData,
      summary: {
        totalSales: salesData.reduce((sum, item) => sum + item.totalSales, 0),
        totalOrders: salesData.reduce((sum, item) => sum + item.orderCount, 0),
        averageOrderValue: salesData.reduce((sum, item) => sum + item.averageOrderValue, 0) / salesData.length || 0
      }
    }
  });
}));

// GET /api/v1/admin/analytics/products - Get product analytics
router.get('/analytics/products', requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const [
    topSellingProducts,
    topRatedProducts,
    lowStockProducts,
    categoryPerformance
  ] = await Promise.all([
    Product.find({ isActive: true })
      .sort({ 'ratings.totalReviews': -1 })
      .limit(10)
      .select('name sku price ratings stockQuantity')
      .lean(),
    Product.find({ isActive: true })
      .sort({ 'ratings.averageRating': -1 })
      .limit(10)
      .select('name sku price ratings')
      .lean(),
    Product.find({ isActive: true, stockQuantity: { $lt: 10 } })
      .sort({ stockQuantity: 1 })
      .limit(10)
      .select('name sku stockQuantity price')
      .lean(),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          averageRating: { $avg: '$ratings.averageRating' },
          totalReviews: { $sum: '$ratings.totalReviews' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      { $sort: { productCount: -1 } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      topSellingProducts,
      topRatedProducts,
      lowStockProducts,
      categoryPerformance
    }
  });
}));

// System Management
// GET /api/v1/admin/system/health - Get system health status
router.get('/system/health', requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const [
    dbStatus,
    redisStatus,
    activeUsers,
    systemUptime,
    memoryUsage,
    cpuUsage
  ] = await Promise.all([
    // TODO: Implement actual health checks
    Promise.resolve({ status: 'healthy', responseTime: 50 }),
    Promise.resolve({ status: 'healthy', responseTime: 10 }),
    User.countDocuments({ lastActiveAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } }),
    Promise.resolve(process.uptime()),
    Promise.resolve(process.memoryUsage()),
    Promise.resolve({ usage: 25 }) // Mock CPU usage
  ]);

  const health = {
    database: dbStatus,
    redis: redisStatus,
    activeUsers,
    systemUptime,
    memoryUsage,
    cpuUsage,
    overall: 'healthy'
  };

  res.json({
    success: true,
    data: health
  });
}));

// POST /api/v1/admin/system/maintenance - Toggle maintenance mode
router.post('/system/maintenance', requireRole('admin'), [
  body('enabled').isBoolean().withMessage('enabled must be a boolean'),
  body('message').optional().trim().isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters')
], validate, asyncHandler(async (req: Request, res: Response) => {
  const { enabled, message } = req.body;

  // TODO: Implement maintenance mode logic
  // This could involve setting a flag in Redis or database

  logger.info(`Maintenance mode ${enabled ? 'enabled' : 'disabled'} by admin: ${(req as any).user.id}`);

  res.json({
    success: true,
    message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`
  });
}));

// Content Management
// GET /api/v1/admin/content/reviews - Get pending reviews
router.get(
  '/content/reviews',
  requireRole('admin'),
  validateRequest([
    ...commonValidations.pagination,
    ...commonValidations.searchQuery,
    ...commonValidations.sort
  ]),
  validate,
  asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [reviews, total] = await Promise.all([
    Review.find({ isApproved: false })
      .populate('user', 'firstName lastName email')
      .populate('product', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean(),
    Review.countDocuments({ isApproved: false })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit as string));

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages,
        hasNext: parseInt(page as string) < totalPages,
        hasPrev: parseInt(page as string) > 1
      }
    }
  });
}));

// POST /api/v1/admin/content/reviews/:id/approve - Approve review
router.post('/content/reviews/:id/approve', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid review ID is required')
], validate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  await review.approve();

  // Update product ratings
  const product = await Product.findById(review.productId);
  if (product) {
    await product.updateRatings(review.rating);
  }

  logger.info(`Review approved: ${review._id} by admin: ${(req as any).user.id}`);

  res.json({
    success: true,
    message: 'Review approved successfully'
  });
}));

// POST /api/v1/admin/content/reviews/:id/reject - Reject review
router.post('/content/reviews/:id/reject', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid review ID is required'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
], validate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const review = await Review.findById(id);
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  await review.reject();

  logger.info(`Review rejected: ${review._id} by admin: ${(req as any).user.id}`);

  res.json({
    success: true,
    message: 'Review rejected successfully'
  });
}));

// Reports
// GET /api/v1/admin/reports/sales - Generate sales report
router.get('/reports/sales', requireRole('admin'), [
  query('startDate').isISO8601().withMessage('Start date is required'),
  query('endDate').isISO8601().withMessage('End date is required'),
  query('format').optional().isIn(['json', 'csv', 'pdf']).withMessage('Invalid format')
], validate, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, format = 'json' } = req.query;

  const salesReport = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string)
        },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          status: '$status'
        },
        totalSales: { $sum: '$total' },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: '$total' }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  const summary = {
    totalSales: salesReport.reduce((sum, item) => sum + item.totalSales, 0),
    totalOrders: salesReport.reduce((sum, item) => sum + item.orderCount, 0),
    averageOrderValue: salesReport.reduce((sum, item) => sum + item.averageOrderValue, 0) / salesReport.length || 0,
    period: { startDate, endDate }
  };

  res.json({
    success: true,
    data: {
      summary,
      details: salesReport,
      format
    }
  });
}));

export default router;
