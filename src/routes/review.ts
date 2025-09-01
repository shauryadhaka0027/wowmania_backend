import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate, commonValidations } from '../middleware/validation';
import { uploadMultiple } from '../middleware/fileUpload';
import { cache } from '../middleware/cache';
import * as reviewController from '../controllers/reviewController';

const router = Router();

// Validation rules
const createReviewValidation = [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').optional().trim().isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  body('comment').trim().isLength({ min: 10, max: 1000 }).withMessage('Comment must be between 10 and 1000 characters'),
  body('orderId').optional().isMongoId().withMessage('Valid order ID is required')
];

const updateReviewValidation = [
  param('id').isMongoId().withMessage('Valid review ID is required'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').optional().trim().isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  body('comment').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Comment must be between 10 and 1000 characters')
];

// GET /api/v1/reviews/product/:productId - Get reviews for a product
router.get('/product/:productId', [
  param('productId').isMongoId().withMessage('Valid product ID is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('sortBy').optional().isIn(['createdAt', 'rating', 'helpful']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating filter must be between 1 and 5'),
  query('verified').optional().isBoolean().withMessage('Verified filter must be a boolean')
], validate, cache, asyncHandler(reviewController.getProductReviews));

// GET /api/v1/reviews/user - Get user's reviews
router.get('/user', requireAuth, asyncHandler(reviewController.getUserReviews));

// POST /api/v1/reviews - Create a new review
router.post('/', requireAuth, uploadMultiple('images', 5), createReviewValidation, validate, asyncHandler(reviewController.createReview));

// PUT /api/v1/reviews/:id - Update a review
router.put('/:id', requireAuth, uploadMultiple('images', 5), updateReviewValidation, validate, asyncHandler(reviewController.updateReview));

// DELETE /api/v1/reviews/:id - Delete a review
router.delete('/:id', requireAuth, [param('id').isMongoId().withMessage('Valid review ID is required')], validate, asyncHandler(reviewController.deleteReview));

// POST /api/v1/reviews/:id/helpful - Mark review as helpful
router.post('/:id/helpful', requireAuth, [param('id').isMongoId().withMessage('Valid review ID is required')], validate, asyncHandler(reviewController.markHelpful));

// DELETE /api/v1/reviews/:id/helpful - Unmark review as helpful
router.delete('/:id/helpful', requireAuth, [param('id').isMongoId().withMessage('Valid review ID is required')], validate, asyncHandler(reviewController.unmarkHelpful));

// POST /api/v1/reviews/:id/report - Report a review
router.post('/:id/report', requireAuth, [
  param('id').isMongoId().withMessage('Valid review ID is required'),
  body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Report reason must be between 10 and 500 characters')
], validate, asyncHandler(reviewController.reportReview));

// Admin routes
// GET /api/v1/reviews/admin/reported - Get reported reviews (Admin only)
router.get('/admin/reported', requireRole('admin'), asyncHandler(reviewController.getReportedReviews));

// POST /api/v1/reviews/admin/:id/approve - Approve a review (Admin only)
router.post('/admin/:id/approve', requireRole('admin'), [param('id').isMongoId().withMessage('Valid review ID is required')], validate, asyncHandler(reviewController.approveReview));

// POST /api/v1/reviews/admin/:id/reject - Reject a review (Admin only)
router.post('/admin/:id/reject', requireRole('admin'), [param('id').isMongoId().withMessage('Valid review ID is required')], validate, asyncHandler(reviewController.rejectReview));

export default router;
