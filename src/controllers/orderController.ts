import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const getOrders = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const userRole = (req as any).user.role;
  const { page = 1, limit = 10, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const filter: any = {};
  
  // If not admin, only show user's orders
  if (userRole !== 'admin') {
    filter.userId = userId;
  }
  
  if (status) filter.status = status;

  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('items.productId', 'name images brand')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Order.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    },
    message: 'Orders retrieved successfully'
  });
};

export const getOrderById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;
  const userRole = (req as any).user.role;

  const filter: any = { _id: id };
  if (userRole !== 'admin') {
    filter.userId = userId;
  }

  const order = await Order.findOne(filter)
    .populate('userId', 'firstName lastName email phone')
    .populate('items.productId', 'name images brand price')
    .lean();

  if (!order) {
    throw createNotFoundError('Order not found');
  }

  res.json({
    success: true,
    data: { order },
    message: 'Order retrieved successfully'
  });
};

export const createOrder = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { shippingAddress, billingAddress, paymentMethod, notes } = req.body;

  // Get user's cart
  const cart = await Cart.findOne({ userId }) as any;
  if (!cart || cart.isEmpty) {
    throw createValidationError('Cart is empty');
  }

  // Validate cart items
  const validationResults = await cart.validateItems();
  if (validationResults.errors.length > 0) {
    return res.status(400).json({
      success: false,
      data: { validationResults },
      message: 'Cart validation failed'
    });
  }

  // Create order from cart
  const orderData = {
    userId,
    items: cart.items.map((item: any) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price: item.price,
      total: item.total
    })),
    shippingAddress: shippingAddress || cart.shippingAddress,
    billingAddress: billingAddress || cart.billingAddress,
    paymentMethod,
    notes,
    subtotal: cart.subtotal,
    tax: cart.tax,
    shipping: cart.shipping,
    discount: cart.discount,
    total: cart.total
  };

  const order = new Order(orderData);
  await order.save();

  // Clear cart after successful order creation
  await cart.clearCart();

  // Update product inventory
  for (const item of order.items) {
    const product = await Product.findById(item.productId);
    if (product && item.variantId) {
      const variant = product.variants.find((v: any) => v._id && v._id.toString() === (item.variantId as string).toString());
      if (variant) {
        variant.inventory.quantity -= item.quantity;
        await product.save();
      }
    }
  }

  logger.info('Order created', { orderId: order._id, userId });

  return res.status(201).json({
    success: true,
    data: { order },
    message: 'Order created successfully'
  });
};

export const updateOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const order = await Order.findById(id);
  if (!order) {
    throw createNotFoundError('Order not found');
  }

  // Only allow certain fields to be updated
  const allowedUpdates = ['status', 'paymentStatus', 'shippingMethod', 'trackingNumber', 'notes'];
  const filteredUpdates: any = {};
  
  allowedUpdates.forEach(field => {
    if (updateData[field] !== undefined) {
      filteredUpdates[field] = updateData[field];
    }
  });

  Object.assign(order, filteredUpdates);
  await order.save();

  logger.info('Order updated', { orderId: id, updatedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { order },
    message: 'Order updated successfully'
  });
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const order = await Order.findById(id);
  if (!order) {
    throw createNotFoundError('Order not found');
  }

  await (order as any).updateStatus(status, notes);

  logger.info('Order status updated', { orderId: id, status, updatedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { order },
    message: 'Order status updated successfully'
  });
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { paymentStatus, transactionId } = req.body;

  const order = await Order.findById(id);
  if (!order) {
    throw createNotFoundError('Order not found');
  }

  await (order as any).updatePaymentStatus(paymentStatus);

  logger.info('Payment status updated', { orderId: id, paymentStatus, updatedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { order },
    message: 'Payment status updated successfully'
  });
};

export const addTracking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { trackingNumber, carrier, trackingUrl } = req.body;

  const order = await Order.findById(id);
  if (!order) {
    throw createNotFoundError('Order not found');
  }

  await (order as any).addTracking(trackingNumber);

  logger.info('Tracking added', { orderId: id, trackingNumber, addedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { order },
    message: 'Tracking information added successfully'
  });
};

export const cancelOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = (req as any).user.id;
  const userRole = (req as any).user.role;

  const filter: any = { _id: id };
  if (userRole !== 'admin') {
    filter.userId = userId;
  }

  const order = await Order.findOne(filter);
  if (!order) {
    throw createNotFoundError('Order not found');
  }

  // Check if order can be cancelled
  if (!(order as any).isRefundable) {
    throw createValidationError('Order cannot be cancelled at this stage');
  }

  // Update order status
  (order as any).status = 'cancelled';
  (order as any).cancelledAt = new Date();
  (order as any).cancellationReason = reason;
  (order as any).cancelledBy = userId;

  await order.save();

  // Restore inventory
  for (const item of order.items) {
    const product = await Product.findById(item.productId);
    if (product && item.variantId) {
      const variant = product.variants.find((v: any) => v._id && v._id.toString() === (item.variantId as string).toString());
      if (variant) {
        variant.inventory.quantity += item.quantity;
        await product.save();
      }
    }
  }

  logger.info('Order cancelled', { orderId: id, cancelledBy: userId, reason });

  res.json({
    success: true,
    data: { order },
    message: 'Order cancelled successfully'
  });
};

export const processRefund = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, reason, refundMethod } = req.body;

  const order = await Order.findById(id);
  if (!order) {
    throw createNotFoundError('Order not found');
  }

  if (order.paymentStatus !== 'completed') {
    throw createValidationError('Order payment status must be completed to process refund');
  }

  const refund = await (order as any).processRefund(amount, reason);

  logger.info('Refund processed', { orderId: id, refundId: refund._id, processedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { refund },
    message: 'Refund processed successfully'
  });
};

export const generateInvoice = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;
  const userRole = (req as any).user.role;

  const filter: any = { _id: id };
  if (userRole !== 'admin') {
    filter.userId = userId;
  }

  const order = await Order.findOne(filter)
    .populate('userId', 'firstName lastName email')
    .populate('items.productId', 'name brand');

  if (!order) {
    throw createNotFoundError('Order not found');
  }

  // TODO: Implement actual invoice generation
  // For now, return order data formatted as invoice
  const invoice = {
    invoiceNumber: `INV-${order.orderNumber}`,
    orderNumber: order.orderNumber,
    customer: order.userId,
    items: order.items,
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    discount: order.discount,
    total: order.total,
    orderDate: order.createdAt,
    dueDate: order.createdAt // Same as order date for immediate payment
  };

  res.json({
    success: true,
    data: { invoice },
    message: 'Invoice generated successfully'
  });
};

export const getOrderStats = async (req: Request, res: Response) => {
  const { period = '30' } = req.query;
  const userId = (req as any).user.id;
  const userRole = (req as any).user.role;

  const filter: any = {};
  if (userRole !== 'admin') {
    filter.userId = userId;
  }

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - Number(period));
  filter.createdAt = { $gte: daysAgo };

  const stats = await Order.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' },
        statusDistribution: { $push: '$status' }
      }
    }
  ]);

  const result = stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    statusDistribution: []
  };

  // Calculate status distribution
  const statusCounts: any = {};
  result.statusDistribution.forEach((status: string) => {
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      stats: {
        totalOrders: result.totalOrders,
        totalRevenue: result.totalRevenue,
        averageOrderValue: result.averageOrderValue,
        statusDistribution: statusCounts
      }
    },
    message: 'Order statistics retrieved successfully'
  });
};
