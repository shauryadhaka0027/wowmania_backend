import { Request, Response } from 'express';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const getCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  let cart = await Cart.findOne({ userId }) as any;
  
  if (!cart) {
    // Create new cart if doesn't exist
    cart = new Cart({ userId });
    await cart.save();
  }

  // Populate product details
  await cart.populate('items.productId', 'name price images brand');

  res.json({
    success: true,
    data: { cart },
    message: 'Cart retrieved successfully'
  });
};

export const addToCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { productId, variantId, quantity = 1 } = req.body;

  // Validate product exists and is active
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw createNotFoundError('Product not found or unavailable');
  }

  // Check if variant exists if provided
  if (variantId) {
    const variant = product.variants.find(v => v._id && v._id.toString() === variantId);
    if (!variant) {
      throw createNotFoundError('Product variant not found');
    }
    
    // Check stock
    if (variant.inventory.quantity < quantity) {
      throw createValidationError('Insufficient stock for this variant');
    }
  } else {
    // Check overall product stock
    const totalStock = product.variants.reduce((sum, variant) => sum + variant.inventory.quantity, 0);
    if (totalStock < quantity) {
      throw createValidationError('Insufficient stock for this product');
    }
  }

  let cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    cart = new Cart({ userId });
  }

  await cart.addItem({ productId, variantId, quantity });
  await cart.populate('items.productId', 'name price images brand');

  res.json({
    success: true,
    data: { cart },
    message: 'Item added to cart successfully'
  });
};

export const updateCartItem = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (quantity <= 0) {
    throw createValidationError('Quantity must be greater than 0');
  }

  const cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    throw createNotFoundError('Cart not found');
  }

  const cartItem = cart.items.find((item: any) => item._id && item._id.toString() === itemId);
  if (!cartItem) {
    throw createNotFoundError('Cart item not found');
  }

  // Check stock availability
  const product = await Product.findById(cartItem.productId);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  if (cartItem.variantId) {
    const variant = product.variants.find(v => v._id && v._id.toString() === cartItem.variantId.toString());
    if (!variant || variant.inventory.quantity < quantity) {
      throw createValidationError('Insufficient stock for this variant');
    }
  } else {
    const totalStock = product.variants.reduce((sum, variant) => sum + variant.inventory.quantity, 0);
    if (totalStock < quantity) {
      throw createValidationError('Insufficient stock for this product');
    }
  }

  await cart.updateItemQuantity(itemId, quantity);
  await cart.populate('items.productId', 'name price images brand');

  res.json({
    success: true,
    data: { cart },
    message: 'Cart item updated successfully'
  });
};

export const removeFromCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { itemId } = req.params;

  const cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    throw createNotFoundError('Cart not found');
  }

  await cart.removeItem(itemId);
  await cart.populate('items.productId', 'name price images brand');

  res.json({
    success: true,
    data: { cart },
    message: 'Item removed from cart successfully'
  });
};

export const clearCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    throw createNotFoundError('Cart not found');
  }

  await cart.clearCart();

  res.json({
    success: true,
    data: { cart },
    message: 'Cart cleared successfully'
  });
};

export const applyCoupon = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { couponCode } = req.body;

  const cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    throw createNotFoundError('Cart not found');
  }

  if (cart.isEmpty) {
    throw createValidationError('Cannot apply coupon to empty cart');
  }

  // TODO: Implement actual coupon validation logic
  // For now, just simulate a 10% discount
  const discountAmount = cart.subtotal * 0.1;
  
  await cart.applyCoupon(couponCode, discountAmount);
  await cart.populate('items.productId', 'name price images brand');

  res.json({
    success: true,
    data: { cart },
    message: 'Coupon applied successfully'
  });
};

export const removeCoupon = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    throw createNotFoundError('Cart not found');
  }

  await cart.removeCoupon();
  await cart.populate('items.productId', 'name price images brand');

  res.json({
    success: true,
    data: { cart },
    message: 'Coupon removed successfully'
  });
};

export const getCartSummary = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    return res.json({
      success: true,
      data: {
        summary: {
          subtotal: 0,
          tax: 0,
          shipping: 0,
          discount: 0,
          total: 0,
          itemCount: 0
        }
      },
      message: 'Cart summary retrieved successfully'
    });
  }

  const summary = {
    subtotal: cart.subtotal,
    tax: cart.tax,
    shipping: cart.shipping,
    discount: cart.discount || 0,
    total: cart.total,
    itemCount: cart.itemCount
  };

  return res.json({
    success: true,
    data: { summary },
    message: 'Cart summary retrieved successfully'
  });
};

export const validateCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const cart = await Cart.findOne({ userId }) as any;
  if (!cart || cart.isEmpty) {
    throw createValidationError('Cart is empty');
  }

  const validationResults = await cart.validateItems();
  
  if (validationResults.errors.length > 0) {
    return res.json({
      success: false,
      data: { validationResults },
      message: 'Cart validation failed'
    });
  }

  return res.json({
    success: true,
    data: { validationResults },
    message: 'Cart is valid'
  });
};

export const mergeGuestCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { guestItems } = req.body;

  if (!guestItems || !Array.isArray(guestItems)) {
    throw createValidationError('Guest items array is required');
  }

  let cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    cart = new Cart({ userId });
  }

  // Merge guest items with user cart
  for (const guestItem of guestItems) {
    const { productId, variantId, quantity } = guestItem;
    
    // Check if item already exists in cart
    const existingItem = cart.items.find((item: any) => 
      item.productId.toString() === productId &&
      (!variantId || item.variantId?.toString() === variantId)
    );

    if (existingItem) {
      // Update quantity
      existingItem.quantity += quantity;
    } else {
      // Add new item
      await cart.addItem({ productId, variantId, quantity });
    }
  }

  await cart.populate('items.productId', 'name price images brand');

  return res.json({
    success: true,
    data: { cart },
    message: 'Guest cart merged successfully'
  });
};

export const checkCartExpiry = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    return res.json({
      success: true,
      data: { isExpired: false },
      message: 'No cart found'
    });
  }

  const isExpired = cart.isExpired();

  if (isExpired) {
    // Clear expired cart
    await cart.clearCart();
  }

  return res.json({
    success: true,
    data: { isExpired },
    message: 'Cart expiry checked successfully'
  });
};

export const extendCartExpiry = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const cart = await Cart.findOne({ userId }) as any;
  if (!cart) {
    throw createNotFoundError('Cart not found');
  }

  await cart.extendExpiry();

  return res.json({
    success: true,
    data: { cart },
    message: 'Cart expiry extended successfully'
  });
};
