import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate, commonValidations, validateRequest } from '../middleware/validation';
import { uploadSingle } from '../middleware/fileUpload';
import { cache } from '../middleware/cache';
import * as categoryController from '../controllers/categoryController';

const router = Router();

// Validation rules
const categoryValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Category name must be between 2 and 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('parent').optional().isMongoId().withMessage('Valid parent category ID is required'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  body('metaTitle').optional().trim().isLength({ max: 60 }).withMessage('Meta title cannot exceed 60 characters'),
  body('metaDescription').optional().trim().isLength({ max: 160 }).withMessage('Meta description cannot exceed 160 characters'),
  body('seoKeywords').optional().isArray().withMessage('SEO keywords must be an array'),
  body('seoKeywords.*').optional().isString().withMessage('Each SEO keyword must be a string')
];

const updateCategoryValidation = [
  param('id').isMongoId().withMessage('Valid category ID is required'),
  ...categoryValidation.map(rule => rule.optional())
];

// GET /api/v1/categories - Get all categories
router.get('/',
  validateRequest([
    ...commonValidations.pagination,
    ...commonValidations.searchQuery,
    ...commonValidations.sort
  ]),
  cache,
  asyncHandler(categoryController.getAllCategories)
);

// GET /api/v1/categories/featured - Get featured categories
router.get('/featured', cache, asyncHandler(categoryController.getFeaturedCategories));

// GET /api/v1/categories/root - Get root categories
router.get('/root', cache, asyncHandler(categoryController.getRootCategories));

// GET /api/v1/categories/:id - Get single category by ID
router.get('/:id', [param('id').isMongoId().withMessage('Valid category ID is required')], validate, cache, asyncHandler(categoryController.getCategoryById));

// GET /api/v1/categories/slug/:slug - Get category by slug
router.get('/slug/:slug', [param('slug').trim().isLength({ min: 1 }).withMessage('Slug is required')], validate, cache, asyncHandler(categoryController.getCategoryBySlug));

// GET /api/v1/categories/:id/children - Get children of a category
router.get('/:id/children', [param('id').isMongoId().withMessage('Valid category ID is required')], validate, cache, asyncHandler(categoryController.getCategoryChildren));

// GET /api/v1/categories/:id/ancestors - Get ancestors of a category
router.get('/:id/ancestors', [param('id').isMongoId().withMessage('Valid category ID is required')], validate, cache, asyncHandler(categoryController.getCategoryAncestors));

// GET /api/v1/categories/:id/descendants - Get descendants of a category
router.get('/:id/descendants', [param('id').isMongoId().withMessage('Valid category ID is required')], validate, cache, asyncHandler(categoryController.getCategoryDescendants));

// POST /api/v1/categories - Create new category (Admin only)
router.post('/', requireRole('admin'), uploadSingle('image'), categoryValidation, validate, asyncHandler(categoryController.createCategory));

// PUT /api/v1/categories/:id - Update category (Admin only)
router.put('/:id', requireRole('admin'), uploadSingle('image'), updateCategoryValidation, validate, asyncHandler(categoryController.updateCategory));

// DELETE /api/v1/categories/:id - Delete category (Admin only)
router.delete('/:id', requireRole('admin'), [param('id').isMongoId().withMessage('Valid category ID is required')], validate, asyncHandler(categoryController.deleteCategory));

// POST /api/v1/categories/:id/move - Move category to new parent (Admin only)
router.post('/:id/move', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid category ID is required'),
  body('newParent').optional().isMongoId().withMessage('Valid parent category ID is required')
], validate, asyncHandler(categoryController.moveCategory));

// POST /api/v1/categories/reorder - Reorder categories (Admin only)
router.post('/reorder', requireRole('admin'), [
  body('categories').isArray().withMessage('Categories must be an array'),
  body('categories.*.id').isMongoId().withMessage('Valid category ID is required'),
  body('categories.*.sortOrder').isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer')
], validate, asyncHandler(categoryController.reorderCategories));

export default router;
