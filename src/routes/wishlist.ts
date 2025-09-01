import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { validate, commonValidations } from '../middleware/validation';
import * as wishlistController from '../controllers/wishlistController';

const router = Router();

// Validation rules
const addToWishlistValidation = [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('variantId').optional().isMongoId().withMessage('Valid variant ID is required'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

// GET /api/v1/wishlist - Get user's wishlist
router.get('/', commonValidations, validate, requireAuth, asyncHandler(wishlistController.getWishlist));

// POST /api/v1/wishlist/add - Add item to wishlist
router.post('/add', requireAuth, addToWishlistValidation, validate, asyncHandler(wishlistController.addToWishlist));

// DELETE /api/v1/wishlist/remove/:itemId - Remove item from wishlist
router.delete('/remove/:itemId', requireAuth, [param('itemId').isMongoId().withMessage('Valid item ID is required')], validate, asyncHandler(wishlistController.removeFromWishlist));

// PUT /api/v1/wishlist/update/:itemId - Update wishlist item
router.put('/update/:itemId', requireAuth, [
  param('itemId').isMongoId().withMessage('Valid item ID is required'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], validate, asyncHandler(wishlistController.updateWishlistItem));

// POST /api/v1/wishlist/clear - Clear entire wishlist
router.post('/clear', requireAuth, asyncHandler(wishlistController.clearWishlist));

// POST /api/v1/wishlist/move-to-cart/:itemId - Move wishlist item to cart
router.post('/move-to-cart/:itemId', requireAuth, [param('itemId').isMongoId().withMessage('Valid item ID is required')], validate, asyncHandler(wishlistController.moveToCart));

// GET /api/v1/wishlist/count - Get wishlist item count
router.get('/count', requireAuth, asyncHandler(wishlistController.getWishlistCount));

// GET /api/v1/wishlist/check/:productId - Check if product is in wishlist
router.get('/check/:productId', requireAuth, [param('productId').isMongoId().withMessage('Valid product ID is required')], validate, asyncHandler(wishlistController.checkInWishlist));

// POST /api/v1/wishlist/share - Share wishlist (generate shareable link)
router.post('/share', requireAuth, asyncHandler(wishlistController.shareWishlist));

// GET /api/v1/wishlist/shared/:token - Get shared wishlist
router.get('/shared/:token', [param('token').isString().withMessage('Valid share token is required')], validate, asyncHandler(wishlistController.getSharedWishlist));

export default router;
