import { Router } from 'express';
import { body, param } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import * as paymentController from '../controllers/paymentController';

const router = Router();



// Validation rules
const createPaymentIntentValidation = [
  body('orderId').isMongoId().withMessage('Valid order ID is required'),
  body('paymentMethod').optional().isString().withMessage('Payment method must be a string')
];

const confirmPaymentValidation = [
  body('paymentIntentId').isString().withMessage('Payment intent ID is required'),
  body('orderId').isMongoId().withMessage('Valid order ID is required')
];

const refundValidation = [
  param('orderId').isMongoId().withMessage('Valid order ID is required'),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Refund amount must be a positive number'),
  body('reason').optional().isString().withMessage('Refund reason must be a string')
];

// POST /api/v1/payments/create-intent - Create payment intent
router.post('/create-intent', requireAuth, createPaymentIntentValidation, validate, asyncHandler(paymentController.createPaymentIntent));

// POST /api/v1/payments/confirm - Confirm payment
router.post('/confirm', requireAuth, confirmPaymentValidation, validate, asyncHandler(paymentController.confirmPayment));

// POST /api/v1/payments/webhook - Stripe webhook handler
router.post('/webhook', asyncHandler(paymentController.handleWebhook));

// POST /api/v1/payments/:orderId/refund - Process refund
router.post('/:orderId/refund', requireAuth, refundValidation, validate, asyncHandler(paymentController.processRefund));

// GET /api/v1/payments/:orderId/status - Get payment status
router.get('/:orderId/status', requireAuth, [param('orderId').isMongoId().withMessage('Valid order ID is required')], validate, asyncHandler(paymentController.getPaymentStatus));

// GET /api/v1/payments/methods - Get available payment methods
router.get('/methods', asyncHandler(paymentController.getPaymentMethods));

export default router;
