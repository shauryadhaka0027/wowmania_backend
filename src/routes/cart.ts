import { Router } from 'express';
import { body, param } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import * as cartController from '../controllers/cartController';

const router = Router();

// Validation rules
const addToCartValidation = [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('variantId').optional().isMongoId().withMessage('Valid variant ID is required')
];

const updateCartItemValidation = [
  param('itemId').isMongoId().withMessage('Valid item ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
];

const applyCouponValidation = [
  body('couponCode').trim().isLength({ min: 1 }).withMessage('Coupon code is required')
];

// GET /api/v1/cart - Get user's cart
router.get('/', requireAuth, asyncHandler(cartController.getCart));

// POST /api/v1/cart/add - Add item to cart
router.post('/add', requireAuth, addToCartValidation, validate, asyncHandler(cartController.addToCart));

// PUT /api/v1/cart/items/:itemId - Update cart item quantity
router.put('/items/:itemId', requireAuth, updateCartItemValidation, validate, asyncHandler(cartController.updateCartItem));

// DELETE /api/v1/cart/items/:itemId - Remove item from cart
router.delete('/items/:itemId', requireAuth, [param('itemId').isMongoId().withMessage('Valid item ID is required')], validate, asyncHandler(cartController.removeFromCart));

// POST /api/v1/cart/clear - Clear all items from cart
router.post('/clear', requireAuth, asyncHandler(cartController.clearCart));

// POST /api/v1/cart/coupon/apply - Apply coupon to cart
router.post('/coupon/apply', requireAuth, applyCouponValidation, validate, asyncHandler(cartController.applyCoupon));

// DELETE /api/v1/cart/coupon/remove - Remove coupon from cart
router.delete('/coupon/remove', requireAuth, asyncHandler(cartController.removeCoupon));

// GET /api/v1/cart/summary - Get cart summary (totals, tax, shipping)
router.get('/summary', requireAuth, asyncHandler(cartController.getCartSummary));

// POST /api/v1/cart/validate - Validate cart items
router.post('/validate', requireAuth, asyncHandler(cartController.validateCart));

// POST /api/v1/cart/merge - Merge guest cart with user cart (for when user logs in)
router.post('/merge', requireAuth, [
  body('guestCartItems').isArray().withMessage('Guest cart items must be an array'),
  body('guestCartItems.*.productId').isMongoId().withMessage('Valid product ID is required'),
  body('guestCartItems.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('guestCartItems.*.variantId').optional().isMongoId().withMessage('Valid variant ID is required')
], validate, asyncHandler(cartController.mergeGuestCart));

// GET /api/v1/cart/expiry - Check cart expiry
router.get('/expiry', requireAuth, asyncHandler(cartController.checkCartExpiry));

// POST /api/v1/cart/extend - Extend cart expiry
router.post('/extend', requireAuth, asyncHandler(cartController.extendCartExpiry));

export default router;
