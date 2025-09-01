import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { createValidationError } from './errorHandler';
import { logger } from '../config/logger';

// Middleware to check validation results
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Validation failed:', {
      errors: errorMessages,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      body: req.body,
      query: req.query,
      params: req.params
    });

    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errorMessages
      },
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Helper function to apply validation chain
export const validateRequest = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for validation errors
    validate(req, res, next);
  };
};

// Common validation rules
export const commonValidations = {
  // ObjectId validation
  isValidObjectId: (field: string) => {
    return {
      in: ['params', 'query', 'body'],
      errorMessage: `${field} must be a valid MongoDB ObjectId`,
      custom: (value: string) => {
        if (!value) return true;
        const objectIdPattern = /^[0-9a-fA-F]{24}$/;
        if (!objectIdPattern.test(value)) {
          throw new Error(`${field} must be a valid MongoDB ObjectId`);
        }
        return true;
      }
    };
  },

  // Pagination validation
  pagination: {
    page: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1 },
        errorMessage: 'Page must be a positive integer'
      },
      toInt: true
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1, max: 100 },
        errorMessage: 'Limit must be between 1 and 100'
      },
      toInt: true
    }
  },

  // Search query validation
  searchQuery: {
    q: {
      in: ['query'],
      optional: true,
      isString: {
        errorMessage: 'Search query must be a string'
      },
      trim: true,
      isLength: {
        options: { min: 1, max: 100 },
        errorMessage: 'Search query must be between 1 and 100 characters'
      }
    }
  },

  // Sort validation
  sort: {
    sort: {
      in: ['query'],
      optional: true,
      isString: {
        errorMessage: 'Sort field must be a string'
      },
      trim: true
    },
    order: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['asc', 'desc']],
        errorMessage: 'Sort order must be either "asc" or "desc"'
      }
    }
  }
};

// File upload validation
export const fileUploadValidation = {
  maxFileSize: (maxSize: number) => ({
    fileSize: {
      options: { max: maxSize },
      errorMessage: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`
    }
  }),

  allowedFileTypes: (types: string[]) => ({
    fileFilter: (req: Request, file: Express.Multer.File, cb: Function) => {
      if (types.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Only ${types.join(', ')} files are allowed`), false);
      }
    }
  })
};

// Rate limiting validation
export const rateLimitValidation = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
};

export default validateRequest;

