import mongoose, { Schema, Document } from 'mongoose';
import { IOrder, IOrderItem, IAddress } from '../types';

const orderItemSchema = new Schema<IOrderItem>({
  productId: {
    type: Schema.Types.ObjectId as any,
    ref: 'Product',
    required: true
  },
  variantId: {
    type: Schema.Types.ObjectId as any,
    ref: 'Product.variants'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  totalPrice: {
    type: Number,
    required: true,
    min: [0, 'Total price cannot be negative']
  },
  image: String
}, { _id: true });

const orderSchema = new Schema<IOrder>({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  userId: {
    type: Schema.Types.ObjectId as any,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  billingAddress: {
    type: Schema.Types.Mixed,
    required: true
  },
  shippingAddress: {
    type: Schema.Types.Mixed,
    required: true
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    required: true,
    min: [0, 'Tax cannot be negative'],
    default: 0
  },
  shipping: {
    type: Number,
    required: true,
    min: [0, 'Shipping cannot be negative'],
    default: 0
  },
  discount: {
    type: Number,
    required: true,
    min: [0, 'Discount cannot be negative'],
    default: 0
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total cannot be negative']
  },
  currency: {
    type: String,
    required: true,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet', 'cod']
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  orderStatus: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  shippingMethod: {
    type: String,
    required: true,
    enum: ['standard', 'express', 'overnight', 'same_day']
  },
  trackingNumber: String,
  estimatedDelivery: Date,
  actualDelivery: Date,
  notes: String,
  customerNotes: String,
  adminNotes: String,
  refundReason: String,
  refundAmount: {
    type: Number,
    min: [0, 'Refund amount cannot be negative']
  },
  refundDate: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for order summary
orderSchema.virtual('orderSummary').get(function() {
  return {
    orderNumber: (this as any).orderNumber,
    totalItems: (this as any).items.length,
    totalQuantity: (this as any).items.reduce((sum: any, item: any) => sum + item.quantity, 0),
    subtotal: (this as any).subtotal,
    tax: (this as any).tax,
    shipping: (this as any).shipping,
    discount: (this as any).discount,
    total: (this as any).total,
    currency: (this as any).currency
  };
});

// Virtual for order status timeline
orderSchema.virtual('statusTimeline').get(function() {
  const timeline = [
    { status: 'pending', timestamp: (this as any).createdAt, description: 'Order placed' }
  ];

  if ((this as any).orderStatus !== 'pending') {
    timeline.push({ status: 'confirmed', timestamp: (this as any).updatedAt, description: 'Order confirmed' });
  }

  if (['processing', 'shipped', 'delivered'].includes((this as any).orderStatus)) {
    timeline.push({ status: 'processing', timestamp: (this as any).updatedAt, description: 'Order processing' });
  }

  if (['shipped', 'delivered'].includes((this as any).orderStatus)) {
    timeline.push({ status: 'shipped', timestamp: (this as any).updatedAt, description: 'Order shipped' });
  }

  if ((this as any).orderStatus === 'delivered') {
    timeline.push({ status: 'delivered', timestamp: (this as any).actualDelivery || (this as any).updatedAt, description: 'Order delivered' });
  }

  if ((this as any).orderStatus === 'cancelled') {
    timeline.push({ status: 'cancelled', timestamp: (this as any).updatedAt, description: 'Order cancelled' });
  }

  if ((this as any).orderStatus === 'returned') {
    timeline.push({ status: 'returned', timestamp: (this as any).updatedAt, description: 'Order returned' });
  }

  return timeline;
});

// Virtual for is refundable
orderSchema.virtual('isRefundable').get(function() {
  if ((this as any).orderStatus !== 'delivered') return false;
  if ((this as any).refundAmount) return false;
  
  const deliveryDate = (this as any).actualDelivery || (this as any).updatedAt;
  const daysSinceDelivery = (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);
  
  return daysSinceDelivery <= 30; // 30 days return policy
});

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ userId: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'items.productId': 1 });
orderSchema.index({ estimatedDelivery: 1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', function(next) {
  if (this.isNew && !(this as any).orderNumber) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    (this as any).orderNumber = `WM${timestamp}${random}`;
  }
  next();
});

// Pre-save middleware to calculate totals
orderSchema.pre('save', function(next) {
  if (this.isModified('items') || this.isModified('subtotal') || this.isModified('tax') || this.isModified('shipping') || this.isModified('discount')) {
    // Recalculate subtotal from items if not provided
    if (!(this as any).subtotal && (this as any).items && (this as any).items.length > 0) {
      (this as any).subtotal = (this as any).items.reduce((sum: any, item: any) => sum + item.totalPrice, 0);
    }
    
    // Calculate total
    (this as any).total = ((this as any).subtotal || 0) + ((this as any).tax || 0) + ((this as any).shipping || 0) - ((this as any).discount || 0);
    
    // Ensure total is not negative
    if ((this as any).total < 0) {
      (this as any).total = 0;
    }
  }
  next();
});

// Pre-save middleware to update item total prices
orderSchema.pre('save', function(next) {
  if ((this as any).items && (this as any).items.length > 0) {
    (this as any).items.forEach((item: any) => {
      if (item.price && item.quantity) {
        item.totalPrice = item.price * item.quantity;
      }
    });
  }
  next();
});

// Static method to find by order number
orderSchema.statics.findByOrderNumber = function(orderNumber: string) {
  return this.findOne({ orderNumber });
};

// Static method to find user orders
orderSchema.statics.findUserOrders = function(userId: string, options: any = {}) {
  const query: any = { userId };
  
  if (options.status) query.orderStatus = options.status;
  if (options.paymentStatus) query.paymentStatus = options.paymentStatus;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('items.productId', 'name images price')
    .limit(options.limit || 20);
};

// Static method to find orders by status
orderSchema.statics.findByStatus = function(status: string, options: any = {}) {
  const query: any = { orderStatus: status };
  
  if (options.paymentStatus) query.paymentStatus = options.paymentStatus;
  if (options.startDate) query.createdAt = { $gte: options.startDate };
  if (options.endDate) query.createdAt = { ...query.createdAt, $lte: options.endDate };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('userId', 'firstName lastName email')
    .populate('items.productId', 'name sku')
    .limit(options.limit || 50);
};

// Static method to find orders needing attention
orderSchema.statics.findNeedingAttention = function() {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  return this.find({
    $or: [
      { orderStatus: 'pending', createdAt: { $lte: threeDaysAgo } },
      { orderStatus: 'confirmed', createdAt: { $lte: threeDaysAgo } },
      { orderStatus: 'processing', createdAt: { $lte: threeDaysAgo } },
      { paymentStatus: 'failed' },
      { paymentStatus: 'pending', createdAt: { $lte: threeDaysAgo } }
    ]
  })
    .populate('userId', 'firstName lastName email phone')
    .sort({ createdAt: 1 });
};

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus: string, notes?: string) {
  const validTransitions: { [key: string]: string[] } = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered', 'returned'],
    delivered: ['returned'],
    cancelled: [],
    returned: []
  };

  const currentStatus = (this as any).orderStatus;
  const allowedTransitions = validTransitions[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
  }

  (this as any).orderStatus = newStatus;
  
  if (notes) {
    (this as any).adminNotes = notes;
  }

  // Set estimated delivery for processing orders
  if (newStatus === 'processing') {
    const deliveryDays = (this as any).shippingMethod === 'express' ? 2 : 
                        (this as any).shippingMethod === 'overnight' ? 1 : 
                        (this as any).shippingMethod === 'same_day' ? 0 : 5;
    
    (this as any).estimatedDelivery = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000);
  }

  // Set actual delivery for delivered orders
  if (newStatus === 'delivered') {
    (this as any).actualDelivery = new Date();
  }

  return this.save();
};

// Method to update payment status
orderSchema.methods.updatePaymentStatus = function(newStatus: string) {
  const validPaymentTransitions: { [key: string]: string[] } = {
    pending: ['processing', 'completed', 'failed'],
    processing: ['completed', 'failed'],
    completed: ['refunded'],
    failed: ['pending'],
    refunded: []
  };

  const currentStatus = (this as any).paymentStatus;
  const allowedTransitions = validPaymentTransitions[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Invalid payment status transition from ${currentStatus} to ${newStatus}`);
  }

  (this as any).paymentStatus = newStatus;
  return this.save();
};

// Method to add tracking information
orderSchema.methods.addTracking = function(trackingNumber: string, estimatedDelivery?: Date) {
  (this as any).trackingNumber = trackingNumber;
  if (estimatedDelivery) {
    (this as any).estimatedDelivery = estimatedDelivery;
  }
  return this.save();
};

// Method to process refund
orderSchema.methods.processRefund = function(amount: number, reason: string) {
  if (amount > (this as any).total) {
    throw new Error('Refund amount cannot exceed order total');
  }

  if ((this as any).refundAmount) {
    throw new Error('Refund already processed for this order');
  }

  (this as any).refundAmount = amount;
  (this as any).refundReason = reason;
  (this as any).refundDate = new Date();
  (this as any).orderStatus = 'returned';

  return this.save();
};

// Method to calculate shipping cost
orderSchema.methods.calculateShipping = function() {
  const baseShippingCosts = {
    standard: 100,
    express: 200,
    overnight: 500,
    same_day: 800
  };

  const baseCost = baseShippingCosts[(this as any).shippingMethod as keyof typeof baseShippingCosts] || 100;
  
  // Add weight-based cost (₹10 per kg)
  const totalWeight = (this as any).items.reduce((sum: any, item: any) => {
    // This would need to be populated with actual product weight
    return sum + (item.quantity || 0);
  }, 0);
  
  const weightCost = totalWeight * 10;
  
  (this as any).shipping = baseCost + weightCost;
  return this.save();
};

export const Order = mongoose.model<IOrder>('Order', orderSchema);
