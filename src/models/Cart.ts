import mongoose, { Schema, Document } from 'mongoose';
import { ICart, ICartItem } from '../types';

const cartItemSchema = new Schema<ICartItem>({
  productId: {
    type: Schema.Types.ObjectId as any,
    ref: 'Product',
    required: true
  },
  variantId: {
    type: Schema.Types.ObjectId as any,
    ref: 'Product.variants'
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    max: [99, 'Quantity cannot exceed 99']
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
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const cartSchema = new Schema<ICart>({
  userId: {
    type: Schema.Types.ObjectId as any,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative'],
    default: 0
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
    min: [0, 'Total cannot be negative'],
    default: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  couponCode: String,
  couponDiscount: {
    type: Number,
    min: [0, 'Coupon discount cannot be negative'],
    default: 0
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Cart expires in 30 days
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      return expiryDate;
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for cart summary
cartSchema.virtual('cartSummary').get(function() {
  return {
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

// Virtual for is empty
cartSchema.virtual('isEmpty').get(function() {
  return (this as any).items.length === 0;
});

// Virtual for item count
cartSchema.virtual('itemCount').get(function() {
  return (this as any).items.reduce((sum: any, item: any) => sum + item.quantity, 0);
});

// Indexes
cartSchema.index({ userId: 1 });
cartSchema.index({ expiresAt: 1 });
cartSchema.index({ 'items.productId': 1 });

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  if (this.isModified('items') || this.isModified('subtotal') || this.isModified('tax') || this.isModified('shipping') || this.isModified('discount') || this.isModified('couponDiscount')) {
    // Calculate subtotal from items
    (this as any).subtotal = (this as any).items.reduce((sum: any, item: any) => sum + item.totalPrice, 0);
    
    // Calculate total
    (this as any).total = (this as any).subtotal + (this as any).tax + (this as any).shipping - (this as any).discount - (this as any).couponDiscount;
    
    // Ensure total is not negative
    if ((this as any).total < 0) {
      (this as any).total = 0;
    }
  }
  next();
});

// Pre-save middleware to update item total prices
cartSchema.pre('save', function(next) {
  if ((this as any).items && (this as any).items.length > 0) {
    (this as any).items.forEach((item: any) => {
      if (item.price && item.quantity) {
        item.totalPrice = item.price * item.quantity;
      }
    });
  }
  next();
});

// Pre-save middleware to update expiry
cartSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set expiry to 30 days from now
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    (this as any).expiresAt = expiryDate;
  }
  next();
});

// Static method to find by user ID
cartSchema.statics.findByUserId = function(userId: string) {
  return this.findOne({ userId }).populate('items.productId', 'name price images inventory');
};

// Static method to find expired carts
cartSchema.statics.findExpired = function() {
  return this.find({ expiresAt: { $lt: new Date() } });
};

// Method to add item to cart
cartSchema.methods.addItem = function(productId: string, variantId: string, quantity: number, price: number) {
  // Check if item already exists
  const existingItem = (this as any).items.find((item: any) => 
    item.productId.toString() === productId && 
    item.variantId?.toString() === variantId
  );

  if (existingItem) {
    // Update existing item quantity
    existingItem.quantity += quantity;
    existingItem.totalPrice = existingItem.price * existingItem.quantity;
    existingItem.addedAt = new Date();
  } else {
    // Add new item
    (this as any).items.push({
      productId,
      variantId,
      quantity,
      price,
      totalPrice: price * quantity,
      addedAt: new Date()
    });
  }

  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId: string, quantity: number) {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }

  if (quantity > 99) {
    throw new Error('Quantity cannot exceed 99');
  }

  const item = (this as any).items.id(itemId);
  if (!item) {
    throw new Error('Item not found in cart');
  }

  item.quantity = quantity;
  item.totalPrice = item.price * quantity;
  item.addedAt = new Date();

  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(itemId: string) {
  (this as any).items = (this as any).items.filter((item: any) => item._id.toString() !== itemId);
  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  (this as any).items = [];
  (this as any).subtotal = 0;
  (this as any).tax = 0;
  (this as any).shipping = 0;
  (this as any).discount = 0;
  (this as any).couponDiscount = 0;
  (this as any).total = 0;
  (this as any).couponCode = undefined;
  
  return this.save();
};

// Method to apply coupon
cartSchema.methods.applyCoupon = function(couponCode: string, discountAmount: number) {
  if (discountAmount > (this as any).subtotal) {
    throw new Error('Coupon discount cannot exceed subtotal');
  }

  (this as any).couponCode = couponCode;
  (this as any).couponDiscount = discountAmount;
  
  return this.save();
};

// Method to remove coupon
cartSchema.methods.removeCoupon = function() {
  (this as any).couponCode = undefined;
  (this as any).couponDiscount = 0;
  
  return this.save();
};

// Method to calculate tax
cartSchema.methods.calculateTax = function(taxRate: number) {
  if (taxRate < 0 || taxRate > 100) {
    throw new Error('Tax rate must be between 0 and 100');
  }

  (this as any).tax = ((this as any).subtotal * taxRate) / 100;
  return this.save();
};

// Method to calculate shipping
cartSchema.methods.calculateShipping = function(shippingMethod: string) {
  const baseShippingCosts = {
    standard: 100,
    express: 200,
    overnight: 500,
    same_day: 800
  };

  const baseCost = baseShippingCosts[shippingMethod as keyof typeof baseShippingCosts] || 100;
  
  // Add weight-based cost (₹10 per kg)
  const totalWeight = (this as any).items.reduce((sum: any, item: any) => {
    // This would need to be populated with actual product weight
    return sum + (item.quantity || 0);
  }, 0);
  
  const weightCost = totalWeight * 10;
  
  (this as any).shipping = baseCost + weightCost;
  return this.save();
};

// Method to check if cart is expired
cartSchema.methods.isExpired = function() {
  return new Date() > (this as any).expiresAt;
};

// Method to extend expiry
cartSchema.methods.extendExpiry = function(days: number = 30) {
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + days);
  (this as any).expiresAt = newExpiry;
  return this.save();
};

// Method to get cart total with currency formatting
cartSchema.methods.getFormattedTotal = function() {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: (this as any).currency
  });
  
  return formatter.format((this as any).total);
};

// Method to validate cart items
cartSchema.methods.validateItems = function() {
  const errors: string[] = [];
  
  for (const item of (this as any).items) {
    if (item.quantity <= 0) {
      errors.push(`Invalid quantity for item ${item.productId}`);
    }
    
    if (item.price < 0) {
      errors.push(`Invalid price for item ${item.productId}`);
    }
    
    if (item.totalPrice !== item.price * item.quantity) {
      errors.push(`Price mismatch for item ${item.productId}`);
    }
  }
  
  return errors;
};

// Static method to find cart by user ID
cartSchema.statics.findByUserId = function(userId: string) {
  return this.findOne({ userId });
};

export const Cart = mongoose.model<ICart>('Cart', cartSchema);
