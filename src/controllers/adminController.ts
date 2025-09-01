import { Request, Response } from 'express';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Category } from '../models/Category';
import { Review } from '../models/Review';
import { Notification } from '../models/Notification';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { getConnectionStatus as getDBStatus } from '../config/database';
import { getConnectionStatus as getRedisStatus } from '../config/redis';

export const getDashboardStats = async (req: Request, res: Response) => {
  const { period = '30' } = req.query;
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - Number(period));

  // Get basic counts
  const [
    totalUsers,
    totalProducts,
    totalOrders,
    pendingOrders,
    lowStockProducts,
    recentOrders,
    topProducts,
    userGrowth,
    revenueGrowth
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.countDocuments({ status: { $in: ['pending', 'processing'] } }),
    Product.countDocuments({
      isActive: true,
      $or: [
        { 'variants.inventory.quantity': { $lt: 10 } },
        { 'variants.inventory.quantity': { $exists: false } }
      ]
    }),
    Order.find()
      .populate('userId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Product.find({ isActive: true })
      .sort({ 'ratings.averageRating': -1, 'ratings.totalReviews': -1 })
      .limit(5)
      .select('name images price ratings')
      .lean(),
    User.countDocuments({ createdAt: { $gte: daysAgo } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: daysAgo } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ])
  ]);

  // Calculate revenue
  const revenue = revenueGrowth[0]?.total || 0;

  // Get monthly stats for charts
  const monthlyStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
      }
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        orders: { $sum: 1 },
        revenue: { $sum: '$total' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,
        pendingOrders,
        lowStockProducts,
        revenue,
        userGrowth,
        revenueGrowth: revenue
      },
      recentOrders,
      topProducts,
      monthlyStats,
      period: Number(period)
    },
    message: 'Dashboard statistics retrieved successfully'
  });
};

export const getAllUsers = async (req: Request, res: Response) => {
  const { page = 1, limit = 20, search, role, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

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

export const updateUserStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  user.isActive = isActive;
  await user.save();

  logger.info('User status updated', { 
    userId: id, 
    isActive, 
    updatedBy: (req as any).user.id 
  });

  res.json({
    success: true,
    data: { user },
    message: 'User status updated successfully'
  });
};

export const updateUserRole = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['customer', 'admin', 'super_admin'].includes(role)) {
    throw createValidationError('Invalid role');
  }

  const user = await User.findById(id);
  if (!user) {
    throw createNotFoundError('User not found');
  }

  user.role = role;
  await user.save();

  logger.info('User role updated', { 
    userId: id, 
    role, 
    updatedBy: (req as any).user.id 
  });

  res.json({
    success: true,
    data: { user },
    message: 'User role updated successfully'
  });
};

export const getInventoryOverview = async (req: Request, res: Response) => {
  const [
    totalProducts,
    lowStockProducts,
    outOfStockProducts,
    productsByCategory
  ] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({
      isActive: true,
      'variants.inventory.quantity': { $lt: 10, $gt: 0 }
    }),
    Product.countDocuments({
      isActive: true,
      $or: [
        { 'variants.inventory.quantity': 0 },
        { 'variants.inventory.quantity': { $exists: false } }
      ]
    }),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          categoryName: { $first: '$categoryInfo.name' }
        }
      },
      { $sort: { count: -1 } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      productsByCategory
    },
    message: 'Inventory overview retrieved successfully'
  });
};

export const bulkUpdateInventory = async (req: Request, res: Response) => {
  const { updates } = req.body;

  if (!Array.isArray(updates)) {
    throw createValidationError('Updates must be an array');
  }

  const results = [];
  for (const update of updates) {
    const { productId, variantId, quantity } = update;

    const product = await Product.findById(productId);
    if (!product) {
      results.push({ productId, success: false, error: 'Product not found' });
      continue;
    }

    if (variantId) {
      const variant = product.variants.find(v => v._id.toString() === variantId);
      if (variant) {
        variant.inventory.quantity = quantity;
        await product.save();
        results.push({ productId, variantId, success: true });
      } else {
        results.push({ productId, variantId, success: false, error: 'Variant not found' });
      }
    } else {
      // Update all variants
      product.variants.forEach(variant => {
        variant.inventory.quantity = quantity;
      });
      await product.save();
      results.push({ productId, success: true });
    }
  }

  logger.info('Bulk inventory update', { 
    updatedBy: (req as any).user.id,
    updateCount: updates.length 
  });

  res.json({
    success: true,
    data: { results },
    message: 'Bulk inventory update completed'
  });
};

export const getSalesAnalytics = async (req: Request, res: Response) => {
  const { period = '30', groupBy = 'day' } = req.query;
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - Number(period));

  let groupStage: any = {};
  if (groupBy === 'day') {
    groupStage = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  } else if (groupBy === 'week') {
    groupStage = { $week: '$createdAt' };
  } else if (groupBy === 'month') {
    groupStage = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
  }

  const salesData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: daysAgo },
        status: { $in: ['completed', 'delivered'] }
      }
    },
    {
      $group: {
        _id: groupStage,
        orders: { $sum: 1 },
        revenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  res.json({
    success: true,
    data: { salesData, period: Number(period), groupBy },
    message: 'Sales analytics retrieved successfully'
  });
};

export const getProductAnalytics = async (req: Request, res: Response) => {
  const [
    topSellingProducts,
    lowRatedProducts,
    categoryPerformance,
    productViews
  ] = await Promise.all([
    Product.find({ isActive: true })
      .sort({ 'ratings.totalReviews': -1 })
      .limit(10)
      .select('name images price ratings')
      .lean(),
    Product.find({ 
      isActive: true,
      'ratings.averageRating': { $lt: 3 }
    })
      .sort({ 'ratings.averageRating': 1 })
      .limit(10)
      .select('name images price ratings')
      .lean(),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          avgRating: { $avg: '$ratings.averageRating' },
          categoryName: { $first: '$categoryInfo.name' }
        }
      },
      { $sort: { productCount: -1 } }
    ]),
    Product.find({ isActive: true })
      .sort({ viewCount: -1 })
      .limit(10)
      .select('name images viewCount')
      .lean()
  ]);

  res.json({
    success: true,
    data: {
      topSellingProducts,
      lowRatedProducts,
      categoryPerformance,
      productViews
    },
    message: 'Product analytics retrieved successfully'
  });
};

export const getSystemHealth = async (req: Request, res: Response) => {
  const [dbStatus, redisStatus] = await Promise.all([
    getDBStatus(),
    getRedisStatus()
  ]);

  const systemHealth = {
    database: dbStatus,
    redis: redisStatus,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date()
  };

  res.json({
    success: true,
    data: { systemHealth },
    message: 'System health status retrieved successfully'
  });
};

export const toggleMaintenanceMode = async (req: Request, res: Response) => {
  const { enabled, message } = req.body;

  // TODO: Implement actual maintenance mode logic
  // This could involve setting a flag in Redis or database
  // and having middleware check this flag

  logger.info('Maintenance mode toggled', { 
    enabled, 
    message, 
    toggledBy: (req as any).user.id 
  });

  res.json({
    success: true,
    data: { enabled, message },
    message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`
  });
};

export const getPendingReviews = async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [reviews, total] = await Promise.all([
    Review.find({ isApproved: false })
      .populate('userId', 'firstName lastName email')
      .populate('productId', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Review.countDocuments({ isApproved: false })
  ]);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    },
    message: 'Pending reviews retrieved successfully'
  });
};

export const approveReview = async (req: Request, res: Response) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  await review.approve();

  // Update product ratings
  const product = await Product.findById(review.productId);
  if (product) {
    await product.updateRatings();
  }

  logger.info('Review approved by admin', { 
    reviewId: id, 
    approvedBy: (req as any).user.id 
  });

  res.json({
    success: true,
    data: { review },
    message: 'Review approved successfully'
  });
};

export const rejectReview = async (req: Request, res: Response) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  await review.reject();

  // Update product ratings
  const product = await Product.findById(review.productId);
  if (product) {
    await product.updateRatings();
  }

  logger.info('Review rejected by admin', { 
    reviewId: id, 
    rejectedBy: (req as any).user.id 
  });

  res.json({
    success: true,
    data: { review },
    message: 'Review rejected successfully'
  });
};

export const generateSalesReport = async (req: Request, res: Response) => {
  const { startDate, endDate, format = 'json' } = req.query;

  const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
  const end = endDate ? new Date(endDate as string) : new Date();

  const report = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['completed', 'delivered'] }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' },
        ordersByStatus: { $push: '$status' }
      }
    }
  ]);

  const result = report[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    ordersByStatus: []
  };

  // Calculate status distribution
  const statusCounts: any = {};
  result.ordersByStatus.forEach((status: string) => {
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const salesReport = {
    period: { start, end },
    summary: {
      totalOrders: result.totalOrders,
      totalRevenue: result.totalRevenue,
      averageOrderValue: result.averageOrderValue,
      statusDistribution: statusCounts
    },
    generatedAt: new Date(),
    generatedBy: (req as any).user.id
  };

  logger.info('Sales report generated', { 
    generatedBy: (req as any).user.id,
    period: { start, end }
  });

  res.json({
    success: true,
    data: { salesReport },
    message: 'Sales report generated successfully'
  });
};
