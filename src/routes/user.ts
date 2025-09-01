import express from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../middleware/validation';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { commonValidations } from '../middleware/validation';
import * as userController from '../controllers/userController';

const router = express.Router();

// Validation rules
const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid Indian phone number'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date')
];

const addressValidation = [
  body('type')
    .isIn(['home', 'work', 'other'])
    .withMessage('Address type must be home, work, or other'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid Indian phone number'),
  body('addressLine1')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Address line 1 must be between 5 and 100 characters'),
  body('city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  body('state')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  body('postalCode')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Postal code must be 6 characters'),
  body('country')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Country must be between 2 and 50 characters')
];

const preferencesValidation = [
  body('language')
    .optional()
    .isIn(['en', 'hi', 'bn', 'ta', 'te', 'ml', 'kn', 'mr', 'gu', 'pa'])
    .withMessage('Invalid language code'),
  body('currency')
    .optional()
    .isIn(['INR', 'USD', 'EUR', 'GBP'])
    .withMessage('Invalid currency code'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  body('marketingEmails')
    .optional()
    .isBoolean()
    .withMessage('Marketing emails must be a boolean'),
  body('pushNotifications')
    .optional()
    .isBoolean()
    .withMessage('Push notifications must be a boolean'),
  body('smsNotifications')
    .optional()
    .isBoolean()
    .withMessage('SMS notifications must be a boolean'),
  body('theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('Theme must be light or dark')
];

// @route   GET /api/v1/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/',
  requireAuth,
  requireRole('admin', 'super_admin'),
  commonValidations.pagination,
  validateRequest,
  asyncHandler(userController.getAllUsers)
);

// @route   GET /api/v1/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id',
  requireAuth,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validateRequest,
  asyncHandler(userController.getUserById)
);

// @route   PUT /api/v1/users/profile
// @desc    Update current user profile
// @access  Private
router.put('/profile',
  requireAuth,
  updateProfileValidation,
  validateRequest,
  asyncHandler(userController.updateProfile)
);

// @route   PUT /api/v1/users/:id
// @desc    Update user by ID (Admin only)
// @access  Private/Admin
router.put('/:id',
  requireAuth,
  requireRole('admin', 'super_admin'),
  param('id').isMongoId().withMessage('Invalid user ID'),
  updateProfileValidation,
  validateRequest,
  asyncHandler(userController.updateUser)
);

// @route   DELETE /api/v1/users/:id
// @desc    Delete user (Admin only)
// @access  Private/Admin
router.delete('/:id',
  requireAuth,
  requireRole('admin', 'super_admin'),
  param('id').isMongoId().withMessage('Invalid user ID'),
  validateRequest,
  asyncHandler(userController.deleteUser)
);

// @route   POST /api/v1/users/addresses
// @desc    Add new address
// @access  Private
router.post('/addresses',
  requireAuth,
  addressValidation,
  validateRequest,
  asyncHandler(userController.addAddress)
);

// @route   PUT /api/v1/users/addresses/:addressId
// @desc    Update address
// @access  Private
router.put('/addresses/:addressId',
  requireAuth,
  param('addressId').isMongoId().withMessage('Invalid address ID'),
  addressValidation,
  validateRequest,
  asyncHandler(userController.updateAddress)
);

// @route   DELETE /api/v1/users/addresses/:addressId
// @desc    Remove address
// @access  Private
router.delete('/addresses/:addressId',
  requireAuth,
  param('addressId').isMongoId().withMessage('Invalid address ID'),
  validateRequest,
  asyncHandler(userController.removeAddress)
);

// @route   PUT /api/v1/users/addresses/:addressId/default
// @desc    Set address as default
// @access  Private
router.put('/addresses/:addressId/default',
  requireAuth,
  param('addressId').isMongoId().withMessage('Invalid address ID'),
  validateRequest,
  asyncHandler(userController.setDefaultAddress)
);

// @route   PUT /api/v1/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences',
  requireAuth,
  preferencesValidation,
  validateRequest,
  asyncHandler(userController.updatePreferences)
);

// @route   GET /api/v1/users/search
// @desc    Search users (Admin only)
// @access  Private/Admin
router.get('/search',
  requireAuth,
  requireRole('admin', 'super_admin'),
  commonValidations.searchQuery,
  commonValidations.pagination,
  validateRequest,
  asyncHandler(userController.searchUsers)
);

export default router;
