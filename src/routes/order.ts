import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate, commonValidations } from '../middleware/validation';
import * as orderController from '../controllers/orderController';

const router = Router();

// Validation rules
const createOrderValidation = [
  body('shippingAddress').isObject().withMessage('Shipping address is required'),
  body('shippingAddress.firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('shippingAddress.lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('shippingAddress.email').isEmail().withMessage('Valid email is required'),
  body('shippingAddress.phone').trim().isLength({ min: 10 }).withMessage('Valid phone number is required'),
  body('shippingAddress.address').trim().isLength({ min: 5 }).withMessage('Address is required'),
  body('shippingAddress.city').trim().isLength({ min: 1 }).withMessage('City is required'),
  body('shippingAddress.state').trim().isLength({ min: 1 }).withMessage('State is required'),
  body('shippingAddress.zipCode').trim().isLength({ min: 3 }).withMessage('Zip code is required'),
  body('shippingAddress.country').trim().isLength({ min: 1 }).withMessage('Country is required'),
  body('billingAddress').optional().isObject().withMessage('Billing address must be an object'),
  body('shippingMethod').trim().isLength({ min: 1 }).withMessage('Shipping method is required'),
  body('paymentMethod').trim().isLength({ min: 1 }).withMessage('Payment method is required'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const updateOrderValidation = [
  param('id').isMongoId().withMessage('Valid order ID is required'),
  body('status').optional().isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).withMessage('Invalid order status'),
  body('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded', 'partially_refunded']).withMessage('Invalid payment status'),
  body('trackingNumber').optional().trim().isLength({ min: 1 }).withMessage('Tracking number cannot be empty'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const orderSearchValidation = [
  query('status').optional().isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).withMessage('Invalid order status'),
  query('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded', 'partially_refunded']).withMessage('Invalid payment status'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('minAmount').optional().isFloat({ min: 0 }).withMessage('Minimum amount must be a positive number'),
  query('maxAmount').optional().isFloat({ min: 0 }).withMessage('Maximum amount must be a positive number')
];

// GET /api/v1/orders - Get user's orders (or all orders for admin)
router.get('/', orderSearchValidation, validate, requireAuth, asyncHandler(orderController.getOrders));

// GET /api/v1/orders/:id - Get single order by ID
router.get('/:id', [param('id').isMongoId().withMessage('Valid order ID is required')], validate, requireAuth, asyncHandler(orderController.getOrderById));

// POST /api/v1/orders - Create new order from cart
router.post('/', requireAuth, createOrderValidation, validate, asyncHandler(orderController.createOrder));

// PUT /api/v1/orders/:id - Update order (Admin only)
router.put('/:id', requireRole('admin'), updateOrderValidation, validate, asyncHandler(orderController.updateOrder));

// POST /api/v1/orders/:id/status - Update order status (Admin only)
router.post('/:id/status', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid order ID is required'),
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).withMessage('Invalid order status'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], validate, asyncHandler(orderController.updateOrderStatus));

// POST /api/v1/orders/:id/payment-status - Update payment status (Admin only)
router.post('/:id/payment-status', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid order ID is required'),
  body('paymentStatus').isIn(['pending', 'paid', 'failed', 'refunded', 'partially_refunded']).withMessage('Invalid payment status'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], validate, asyncHandler(orderController.updatePaymentStatus));

// POST /api/v1/orders/:id/tracking - Add tracking information (Admin only)
router.post('/:id/tracking', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid order ID is required'),
  body('trackingNumber').trim().isLength({ min: 1 }).withMessage('Tracking number is required'),
  body('carrier').trim().isLength({ min: 1 }).withMessage('Carrier is required'),
  body('trackingUrl').optional().isURL().withMessage('Valid tracking URL is required'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], validate, asyncHandler(orderController.addTracking));

// POST /api/v1/orders/:id/cancel - Cancel order
router.post('/:id/cancel', requireAuth, [param('id').isMongoId().withMessage('Valid order ID is required')], validate, asyncHandler(orderController.cancelOrder));

// GET /api/v1/orders/:id/invoice - Get order invoice
router.get('/:id/invoice', requireAuth, [param('id').isMongoId().withMessage('Valid order ID is required')], validate, asyncHandler(orderController.generateInvoice));

// GET /api/v1/orders/stats/summary - Get order statistics (Admin only)
router.get('/stats/summary', requireRole('admin'), asyncHandler(orderController.getOrderStats));

export default router;
