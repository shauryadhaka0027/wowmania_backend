import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireAuth, requireRole } from '../middleware/auth';
import { validate, commonValidations } from '../middleware/validation';
import { uploadSingle, uploadMultiple } from '../middleware/fileUpload';
import { cache } from '../middleware/cache';
import * as productController from '../controllers/productController';

const router = Router();

// Validation rules
const productValidation = [
  body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Product name must be between 2 and 200 characters'),
  body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be between 10 and 2000 characters'),
  body('brand').trim().isLength({ min: 1, max: 100 }).withMessage('Brand must be between 1 and 100 characters'),
  body('category').isMongoId().withMessage('Valid category ID is required'),
  body('sku').trim().isLength({ min: 3, max: 50 }).withMessage('SKU must be between 3 and 50 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('comparePrice').optional().isFloat({ min: 0 }).withMessage('Compare price must be a positive number'),
  body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
  body('dimensions.length').optional().isFloat({ min: 0 }).withMessage('Length must be a positive number'),
  body('dimensions.width').optional().isFloat({ min: 0 }).withMessage('Width must be a positive number'),
  body('dimensions.height').optional().isFloat({ min: 0 }).withMessage('Height must be a positive number'),
  body('stockQuantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().withMessage('Each tag must be a string')
];

const updateProductValidation = [
  param('id').isMongoId().withMessage('Valid product ID is required'),
  ...productValidation.map(rule => rule.optional())
];

const searchValidation = [
  query('q').optional().trim().isLength({ min: 1 }).withMessage('Search query must not be empty'),
  query('category').optional().isMongoId().withMessage('Valid category ID is required'),
  query('brand').optional().trim().isLength({ min: 1 }).withMessage('Brand must not be empty'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Minimum price must be a positive number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Maximum price must be a positive number'),
  query('inStock').optional().isBoolean().withMessage('inStock must be a boolean'),
  query('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
  query('sortBy').optional().isIn(['name', 'price', 'createdAt', 'rating', 'popularity']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  ...commonValidations
];

// GET /api/v1/products - Get all products with pagination and filtering
router.get('/', searchValidation, validate, cache, asyncHandler(productController.getAllProducts));

// GET /api/v1/products/featured - Get featured products
router.get('/featured', cache, asyncHandler(productController.getFeaturedProducts));

// GET /api/v1/products/bestsellers - Get best selling products
router.get('/bestsellers', cache, asyncHandler(productController.getBestSellers));

// GET /api/v1/products/new-arrivals - Get new arrivals
router.get('/new-arrivals', cache, asyncHandler(productController.getNewArrivals));

// GET /api/v1/products/on-sale - Get products on sale
router.get('/on-sale', cache, asyncHandler(productController.getOnSaleProducts));

// GET /api/v1/products/:id - Get single product by ID
router.get('/:id', [param('id').isMongoId().withMessage('Valid product ID is required')], validate, cache, asyncHandler(productController.getProductById));

// POST /api/v1/products - Create new product (Admin only)
router.post('/', requireRole('admin'), uploadMultiple('images', 10), productValidation, validate, asyncHandler(productController.createProduct));

// PUT /api/v1/products/:id - Update product (Admin only)
router.put('/:id', requireRole('admin'), uploadMultiple('images', 10), updateProductValidation, validate, asyncHandler(productController.updateProduct));

// DELETE /api/v1/products/:id - Delete product (Admin only)
router.delete('/:id', requireRole('admin'), [param('id').isMongoId().withMessage('Valid product ID is required')], validate, asyncHandler(productController.deleteProduct));

// POST /api/v1/products/:id/variants - Add variant to product (Admin only)
router.post('/:id/variants', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid product ID is required'),
  body('name').trim().isLength({ min: 1 }).withMessage('Variant name is required'),
  body('sku').trim().isLength({ min: 1 }).withMessage('Variant SKU is required'),
  body('price').isFloat({ min: 0 }).withMessage('Variant price must be a positive number'),
  body('stockQuantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer')
], validate, asyncHandler(productController.addVariant));

// PUT /api/v1/products/:id/variants/:variantId - Update variant (Admin only)
router.put('/:id/variants/:variantId', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid product ID is required'),
  param('variantId').isMongoId().withMessage('Valid variant ID is required')
], validate, asyncHandler(productController.updateVariant));

// DELETE /api/v1/products/:id/variants/:variantId - Remove variant (Admin only)
router.delete('/:id/variants/:variantId', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid product ID is required'),
  param('variantId').isMongoId().withMessage('Valid variant ID is required')
], validate, asyncHandler(productController.removeVariant));

// POST /api/v1/products/:id/images - Add images to product (Admin only)
router.post('/:id/images', requireRole('admin'), uploadMultiple('images', 10), [
  param('id').isMongoId().withMessage('Valid product ID is required')
], validate, asyncHandler(productController.addImages));

// PUT /api/v1/products/:id/images/:imageId - Update image (Admin only)
router.put('/:id/images/:imageId', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid product ID is required'),
  param('imageId').isMongoId().withMessage('Valid image ID is required')
], validate, asyncHandler(productController.updateImage));

// DELETE /api/v1/products/:id/images/:imageId - Remove image (Admin only)
router.delete('/:id/images/:imageId', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid product ID is required'),
  param('imageId').isMongoId().withMessage('Valid image ID is required')
], validate, asyncHandler(productController.removeImage));

// POST /api/v1/products/:id/set-primary-image - Set primary image (Admin only)
router.post('/:id/set-primary-image', requireRole('admin'), [
  param('id').isMongoId().withMessage('Valid product ID is required'),
  body('imageId').isMongoId().withMessage('Valid image ID is required')
], validate, asyncHandler(productController.setPrimaryImage));

export default router;
