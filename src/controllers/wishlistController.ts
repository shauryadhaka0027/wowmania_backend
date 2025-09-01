import { Request, Response } from 'express';
import { Wishlist } from '../models/Wishlist';
import { Product } from '../models/Product';
import { Cart } from '../models/Cart';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const getWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { page = 1, limit = 20 } = req.query;

  let wishlist = await Wishlist.findByUserId(userId);
  
  if (!wishlist) {
    // Create new wishlist if doesn't exist
    wishlist = new Wishlist({ userId });
    await wishlist.save();
  }

  // Populate product details
  await wishlist.populate('items.productId', 'name price images brand isActive');

  // Filter out inactive products
  wishlist.items = wishlist.items.filter(item => 
    item.productId && (item.productId as any).isActive
  );

  // Apply pagination
  const skip = (Number(page) - 1) * Number(limit);
  const paginatedItems = wishlist.items.slice(skip, skip + Number(limit));

  res.json({
    success: true,
    data: {
      items: paginatedItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: wishlist.items.length,
        pages: Math.ceil(wishlist.items.length / Number(limit))
      }
    },
    message: 'Wishlist retrieved successfully'
  });
};

export const addToWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { productId, variantId, notes } = req.body;

  // Validate product exists and is active
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw createNotFoundError('Product not found or unavailable');
  }

  // Check if variant exists if provided
  if (variantId) {
    const variant = product.variants.find(v => v._id.toString() === variantId);
    if (!variant) {
      throw createNotFoundError('Product variant not found');
    }
  }

  let wishlist = await Wishlist.findByUserId(userId);
  if (!wishlist) {
    wishlist = new Wishlist({ userId });
  }

  try {
    await wishlist.addItem({ productId, variantId, notes });
    await wishlist.populate('items.productId', 'name price images brand');

    res.json({
      success: true,
      data: { wishlist },
      message: 'Item added to wishlist successfully'
    });
  } catch (error) {
    if (error.message === 'Item already exists in wishlist') {
      throw createValidationError('Item already exists in wishlist');
    }
    throw error;
  }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { itemId } = req.params;

  const wishlist = await Wishlist.findByUserId(userId);
  if (!wishlist) {
    throw createNotFoundError('Wishlist not found');
  }

  await wishlist.removeItem(itemId);
  await wishlist.populate('items.productId', 'name price images brand');

  res.json({
    success: true,
    data: { wishlist },
    message: 'Item removed from wishlist successfully'
  });
};

export const updateWishlistItem = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { itemId } = req.params;
  const { notes } = req.body;

  const wishlist = await Wishlist.findByUserId(userId);
  if (!wishlist) {
    throw createNotFoundError('Wishlist not found');
  }

  await wishlist.updateItem(itemId, { notes });
  await wishlist.populate('items.productId', 'name price images brand');

  res.json({
    success: true,
    data: { wishlist },
    message: 'Wishlist item updated successfully'
  });
};

export const clearWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const wishlist = await Wishlist.findByUserId(userId);
  if (!wishlist) {
    throw createNotFoundError('Wishlist not found');
  }

  await wishlist.clearWishlist();

  res.json({
    success: true,
    data: { wishlist },
    message: 'Wishlist cleared successfully'
  });
};

export const moveToCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { itemId } = req.params;
  const { quantity = 1 } = req.body;

  const wishlist = await Wishlist.findByUserId(userId);
  if (!wishlist) {
    throw createNotFoundError('Wishlist not found');
  }

  const wishlistItem = wishlist.items.find(item => item._id.toString() === itemId);
  if (!wishlistItem) {
    throw createNotFoundError('Wishlist item not found');
  }

  // Validate product exists and is active
  const product = await Product.findById(wishlistItem.productId);
  if (!product || !product.isActive) {
    throw createNotFoundError('Product not found or unavailable');
  }

  // Check stock availability
  if (wishlistItem.variantId) {
    const variant = product.variants.find(v => v._id.toString() === wishlistItem.variantId.toString());
    if (!variant || variant.inventory.quantity < quantity) {
      throw createValidationError('Insufficient stock for this variant');
    }
  } else {
    const totalStock = product.variants.reduce((sum, variant) => sum + variant.inventory.quantity, 0);
    if (totalStock < quantity) {
      throw createValidationError('Insufficient stock for this product');
    }
  }

  // Add to cart
  let cart = await Cart.findByUserId(userId);
  if (!cart) {
    cart = new Cart({ userId });
  }

  await cart.addItem({
    productId: wishlistItem.productId,
    variantId: wishlistItem.variantId,
    quantity
  });

  // Remove from wishlist
  await wishlist.removeItem(itemId);

  await cart.populate('items.productId', 'name price images brand');
  await wishlist.populate('items.productId', 'name price images brand');

  res.json({
    success: true,
    data: { cart, wishlist },
    message: 'Item moved to cart successfully'
  });
};

export const getWishlistCount = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const wishlist = await Wishlist.findByUserId(userId);
  const count = wishlist ? wishlist.itemCount : 0;

  res.json({
    success: true,
    data: { count },
    message: 'Wishlist count retrieved successfully'
  });
};

export const checkInWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { productId } = req.params;
  const { variantId } = req.query;

  const wishlist = await Wishlist.findByUserId(userId);
  if (!wishlist) {
    return res.json({
      success: true,
      data: { isInWishlist: false },
      message: 'Product not in wishlist'
    });
  }

  const isInWishlist = wishlist.isItemInWishlist(productId, variantId as string);

  res.json({
    success: true,
    data: { isInWishlist },
    message: isInWishlist ? 'Product is in wishlist' : 'Product not in wishlist'
  });
};

export const shareWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const wishlist = await Wishlist.findByUserId(userId);
  if (!wishlist) {
    throw createNotFoundError('Wishlist not found');
  }

  if (wishlist.isEmpty) {
    throw createValidationError('Cannot share empty wishlist');
  }

  const shareToken = wishlist.generateShareToken();
  await wishlist.save();

  const shareUrl = `${process.env.FRONTEND_URL}/wishlist/shared/${shareToken}`;

  res.json({
    success: true,
    data: { 
      shareToken,
      shareUrl,
      expiresAt: wishlist.shareExpiresAt
    },
    message: 'Wishlist share link generated successfully'
  });
};

export const getSharedWishlist = async (req: Request, res: Response) => {
  const { token } = req.params;

  const wishlist = await Wishlist.findByShareToken(token);
  if (!wishlist) {
    throw createNotFoundError('Shared wishlist not found or expired');
  }

  await wishlist.populate('items.productId', 'name price images brand isActive');

  // Filter out inactive products
  const activeItems = wishlist.items.filter(item => 
    item.productId && (item.productId as any).isActive
  );

  res.json({
    success: true,
    data: { 
      items: activeItems,
      itemCount: activeItems.length,
      sharedBy: wishlist.userId,
      expiresAt: wishlist.shareExpiresAt
    },
    message: 'Shared wishlist retrieved successfully'
  });
};
