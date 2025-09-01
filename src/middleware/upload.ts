import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { config } from '../config/logger';
import { createValidationError } from './errorHandler';

// Configure storage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: Function) => {
    cb(null, 'uploads/');
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// Configure memory storage for processing before saving
const memoryStorage = multer.memoryStorage();

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: Function) => {
  const allowedTypes = config.fileUpload.allowedTypes;
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(createValidationError(
      `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      'INVALID_FILE_TYPE'
    ), false);
  }
};

// Configure multer for disk storage
export const uploadToDisk = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.fileUpload.maxSize, // 10MB default
    files: 10 // Maximum 10 files
  }
});

// Configure multer for memory storage
export const uploadToMemory = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.fileUpload.maxSize,
    files: 10
  }
});

// Single file upload middleware
export const uploadSingle = (fieldName: string) => {
  return uploadToDisk.single(fieldName);
};

// Multiple files upload middleware
export const uploadMultiple = (fieldName: string, maxCount: number = 10) => {
  return uploadToDisk.array(fieldName, maxCount);
};

// Multiple fields upload middleware
export const uploadFields = (fields: multer.Field[]) => {
  return uploadToDisk.fields(fields);
};

// Memory upload for single file
export const uploadSingleToMemory = (fieldName: string) => {
  return uploadToMemory.single(fieldName);
};

// Memory upload for multiple files
export const uploadMultipleToMemory = (fieldName: string, maxCount: number = 10) => {
  return uploadToMemory.array(fieldName, maxCount);
};

// Error handling middleware for multer
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    let code = 'UPLOAD_ERROR';

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File size exceeds limit of ${Math.round(config.fileUpload.maxSize / 1024 / 1024)}MB`;
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        code = 'UNEXPECTED_FILE';
        break;
      default:
        message = error.message;
    }

    return res.status(400).json({
      success: false,
      error: {
        message,
        code
      },
      timestamp: new Date().toISOString()
    });
  }

  next(error);
};

// Helper function to get file extension
export const getFileExtension = (filename: string): string => {
  return path.extname(filename).toLowerCase();
};

// Helper function to check if file is image
export const isImageFile = (mimetype: string): boolean => {
  return mimetype.startsWith('image/');
};

// Helper function to check if file is video
export const isVideoFile = (mimetype: string): boolean => {
  return mimetype.startsWith('video/');
};

// Helper function to check if file is document
export const isDocumentFile = (mimetype: string): boolean => {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  return documentTypes.includes(mimetype);
};

export default {
  uploadSingle,
  uploadMultiple,
  uploadFields,
  uploadSingleToMemory,
  uploadMultipleToMemory,
  handleUploadError
};


