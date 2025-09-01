import { Request, Response } from 'express';
import Stripe from 'stripe';
import { Order } from '../models/Order';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { config } from '../config/env';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16'
});

export const createPaymentIntent = async (req: Request, res: Response) => {
  const { orderId, paymentMethod } = req.body;
  const userId = (req as any).user.id;

  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    throw createNotFoundError('Order not found');
  }

  if (order.paymentStatus === 'paid') {
    throw createValidationError('Order is already paid');
  }

  if (order.status === 'cancelled') {
    throw createValidationError('Cannot process payment for cancelled order');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        orderId: order._id.toString(),
        userId: userId,
        orderNumber: order.orderNumber
      },
      payment_method_types: ['card'],
      description: `Payment for order ${order.orderNumber}`,
      receipt_email: (req as any).user.email
    });

    // Update order with payment intent ID
    order.paymentIntentId = paymentIntent.id;
    order.paymentMethod = paymentMethod;
    await order.save();

    logger.info('Payment intent created', { 
      orderId: order._id, 
      paymentIntentId: paymentIntent.id,
      amount: order.total 
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      },
      message: 'Payment intent created successfully'
    });
  } catch (error) {
    logger.error('Error creating payment intent', { error, orderId: order._id });
    throw createValidationError('Failed to create payment intent');
  }
};

export const confirmPayment = async (req: Request, res: Response) => {
  const { paymentIntentId, paymentMethodId } = req.body;
  const userId = (req as any).user.id;

  try {
    // Confirm the payment intent
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId
    });

    if (paymentIntent.status === 'succeeded') {
      // Find and update the order
      const order = await Order.findOne({ 
        paymentIntentId, 
        userId 
      });

      if (!order) {
        throw createNotFoundError('Order not found');
      }

      // Update order payment status
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      order.transactionId = paymentIntent.latest_charge as string;
      await order.save();

      logger.info('Payment confirmed', { 
        orderId: order._id, 
        paymentIntentId,
        amount: order.total 
      });

      res.json({
        success: true,
        data: { 
          order,
          paymentIntent 
        },
        message: 'Payment confirmed successfully'
      });
    } else {
      throw createValidationError(`Payment failed: ${paymentIntent.status}`);
    }
  } catch (error) {
    logger.error('Error confirming payment', { error, paymentIntentId });
    throw createValidationError('Failed to confirm payment');
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    );
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook', { error, eventType: event.type });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

const handlePaymentSucceeded = async (paymentIntent: Stripe.PaymentIntent) => {
  const order = await Order.findOne({ paymentIntentId: paymentIntent.id });
  if (!order) {
    logger.error('Order not found for payment intent', { paymentIntentId: paymentIntent.id });
    return;
  }

  order.paymentStatus = 'paid';
  order.paidAt = new Date();
  order.transactionId = paymentIntent.latest_charge as string;
  await order.save();

  logger.info('Payment succeeded via webhook', { 
    orderId: order._id, 
    paymentIntentId: paymentIntent.id 
  });
};

const handlePaymentFailed = async (paymentIntent: Stripe.PaymentIntent) => {
  const order = await Order.findOne({ paymentIntentId: paymentIntent.id });
  if (!order) {
    logger.error('Order not found for payment intent', { paymentIntentId: paymentIntent.id });
    return;
  }

  order.paymentStatus = 'failed';
  order.paymentFailureReason = paymentIntent.last_payment_error?.message;
  await order.save();

  logger.info('Payment failed via webhook', { 
    orderId: order._id, 
    paymentIntentId: paymentIntent.id,
    reason: paymentIntent.last_payment_error?.message 
  });
};

const handleChargeRefunded = async (charge: Stripe.Charge) => {
  const order = await Order.findOne({ transactionId: charge.id });
  if (!order) {
    logger.error('Order not found for charge', { chargeId: charge.id });
    return;
  }

  // Create refund record
  const refund = {
    amount: charge.amount_refunded / 100, // Convert from cents
    reason: 'Customer request',
    refundMethod: 'stripe',
    refundedAt: new Date(),
    stripeRefundId: charge.refunds?.data[0]?.id
  };

  order.refunds.push(refund);
  order.paymentStatus = 'refunded';
  await order.save();

  logger.info('Charge refunded via webhook', { 
    orderId: order._id, 
    chargeId: charge.id,
    refundAmount: refund.amount 
  });
};

export const processRefund = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { amount, reason } = req.body;
  const userId = (req as any).user.id;

  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    throw createNotFoundError('Order not found');
  }

  if (order.paymentStatus !== 'paid') {
    throw createValidationError('Order must be paid to process refund');
  }

  if (!order.transactionId) {
    throw createValidationError('No transaction ID found for this order');
  }

  try {
    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      charge: order.transactionId,
      amount: Math.round(amount * 100), // Convert to cents
      reason: 'requested_by_customer',
      metadata: {
        orderId: order._id.toString(),
        userId: userId,
        reason: reason
      }
    });

    // Update order with refund information
    const refundRecord = {
      amount: amount,
      reason: reason,
      refundMethod: 'stripe',
      refundedAt: new Date(),
      stripeRefundId: refund.id
    };

    order.refunds.push(refundRecord);
    order.paymentStatus = 'refunded';
    await order.save();

    logger.info('Refund processed', { 
      orderId: order._id, 
      refundId: refund.id,
      amount: amount,
      processedBy: userId 
    });

    res.json({
      success: true,
      data: { 
        refund: refundRecord,
        stripeRefund: refund 
      },
      message: 'Refund processed successfully'
    });
  } catch (error) {
    logger.error('Error processing refund', { error, orderId: order._id });
    throw createValidationError('Failed to process refund');
  }
};

export const getPaymentStatus = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const userId = (req as any).user.id;

  const order = await Order.findOne({ _id: orderId, userId })
    .select('paymentStatus paymentIntentId transactionId paidAt refunds');

  if (!order) {
    throw createNotFoundError('Order not found');
  }

  let paymentDetails = null;
  
  if (order.paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
      paymentDetails = {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        created: paymentIntent.created,
        lastPaymentError: paymentIntent.last_payment_error
      };
    } catch (error) {
      logger.error('Error retrieving payment intent', { error, paymentIntentId: order.paymentIntentId });
    }
  }

  res.json({
    success: true,
    data: {
      paymentStatus: order.paymentStatus,
      transactionId: order.transactionId,
      paidAt: order.paidAt,
      refunds: order.refunds,
      paymentDetails
    },
    message: 'Payment status retrieved successfully'
  });
};

export const getPaymentMethods = async (req: Request, res: Response) => {
  // Mock payment methods - in a real app, you'd fetch from Stripe or your database
  const paymentMethods = [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      description: 'Visa, Mastercard, American Express',
      icon: '💳',
      enabled: true
    },
    {
      id: 'upi',
      name: 'UPI',
      description: 'Unified Payments Interface',
      icon: '📱',
      enabled: true
    },
    {
      id: 'netbanking',
      name: 'Net Banking',
      description: 'Direct bank transfer',
      icon: '🏦',
      enabled: true
    },
    {
      id: 'cod',
      name: 'Cash on Delivery',
      description: 'Pay when you receive',
      icon: '💰',
      enabled: true
    }
  ];

  res.json({
    success: true,
    data: { paymentMethods },
    message: 'Payment methods retrieved successfully'
  });
};
