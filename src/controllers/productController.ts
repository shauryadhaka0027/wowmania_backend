import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const getAllProducts = async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 12,
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    inStock,
    onSale
  } = req.query;

  const filter: any = { isActive: true };

  // Search filter
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
      { 'variants.name': { $regex: search, $options: 'i' } }
    ];
  }

  // Category filter
  if (category) {
    const categoryDoc = await Category.findOne({ slug: category });
    if (categoryDoc) {
      filter.category = categoryDoc._id;
    }
  }

  // Brand filter
  if (brand) {
    filter.brand = { $regex: brand, $options: 'i' };
  }

  // Price filter
  if (minPrice || maxPrice) {
    filter.finalPrice = {};
    if (minPrice) filter.finalPrice.$gte = Number(minPrice);
    if (maxPrice) filter.finalPrice.$lte = Number(maxPrice);
  }

  // Stock filter
  if (inStock === 'true') {
    filter['variants.inventory.quantity'] = { $gt: 0 };
  }

  // Sale filter
  if (onSale === 'true') {
    filter.isOnSale = true;
  }

  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    },
    message: 'Products retrieved successfully'
  });
};

export const getFeaturedProducts = async (req: Request, res: Response) => {
  const { limit = 8 } = req.query;

  const products = await Product.find({ isActive: true, isFeatured: true })
    .populate('category', 'name slug')
    .sort({ featuredOrder: 1, createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json({
    success: true,
    data: { products },
    message: 'Featured products retrieved successfully'
  });
};

export const getBestSellers = async (req: Request, res: Response) => {
  const { limit = 8 } = req.query;

  const products = await Product.find({ isActive: true })
    .populate('category', 'name slug')
    .sort({ 'ratings.averageRating': -1, 'ratings.totalReviews': -1 })
    .limit(Number(limit))
    .lean();

  res.json({
    success: true,
    data: { products },
    message: 'Best sellers retrieved successfully'
  });
};

export const getNewArrivals = async (req: Request, res: Response) => {
  const { limit = 8 } = req.query;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const products = await Product.find({
    isActive: true,
    createdAt: { $gte: thirtyDaysAgo }
  })
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json({
    success: true,
    data: { products },
    message: 'New arrivals retrieved successfully'
  });
};

export const getOnSaleProducts = async (req: Request, res: Response) => {
  const { limit = 8 } = req.query;

  const products = await Product.find({ isActive: true, isOnSale: true })
    .populate('category', 'name slug')
    .sort({ discountPercentage: -1 })
    .limit(Number(limit))
    .lean();

  res.json({
    success: true,
    data: { products },
    message: 'On sale products retrieved successfully'
  });
};

export const getProductById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const product = await Product.findById(id)
    .populate('category', 'name slug')
    .populate('reviews', 'rating comment createdAt')
    .lean();

  if (!product) {
    throw createNotFoundError('Product not found');
  }

  // Increment view count
  await Product.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

  res.json({
    success: true,
    data: { product },
    message: 'Product retrieved successfully'
  });
};

export const createProduct = async (req: Request, res: Response) => {
  const productData = req.body;
  const images = (req.files as Express.Multer.File[]) || [];

  // Handle image uploads
  if (images.length > 0) {
    productData.images = images.map(file => file.path);
    if (productData.images.length > 0) {
      productData.primaryImage = productData.images[0];
    }
  }

  const product = new Product(productData);
  await product.save();

  logger.info('Product created', { productId: product._id, createdBy: (req as any).user.id });

  res.status(201).json({
    success: true,
    data: { product },
    message: 'Product created successfully'
  });
};

export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  const images = (req.files as Express.Multer.File[]) || [];

  const product = await Product.findById(id);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  // Handle image uploads
  if (images.length > 0) {
    const newImages = images.map(file => file.path);
    updateData.images = [...(product.images || []), ...newImages];
    if (!product.primaryImage && newImages.length > 0) {
      updateData.primaryImage = newImages[0];
    }
  }

  Object.assign(product, updateData);
  await product.save();

  logger.info('Product updated', { productId: id, updatedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { product },
    message: 'Product updated successfully'
  });
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  // Soft delete
  product.isActive = false;
  product.deletedAt = new Date();
  await product.save();

  logger.info('Product deleted', { productId: id, deletedBy: (req as any).user.id });

  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
};

export const addVariant = async (req: Request, res: Response) => {
  const { id } = req.params;
  const variantData = req.body;

  const product = await Product.findById(id);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  await product.addVariant(variantData);

  res.json({
    success: true,
    data: { product },
    message: 'Variant added successfully'
  });
};

export const updateVariant = async (req: Request, res: Response) => {
  const { id, variantId } = req.params;
  const variantData = req.body;

  const product = await Product.findById(id);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  await product.updateVariant(variantId, variantData);

  res.json({
    success: true,
    data: { product },
    message: 'Variant updated successfully'
  });
};

export const removeVariant = async (req: Request, res: Response) => {
  const { id, variantId } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  await product.removeVariant(variantId);

  res.json({
    success: true,
    data: { product },
    message: 'Variant removed successfully'
  });
};

export const addImages = async (req: Request, res: Response) => {
  const { id } = req.params;
  const images = (req.files as Express.Multer.File[]) || [];

  if (images.length === 0) {
    throw createValidationError('No images provided');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  const imagePaths = images.map(file => file.path);
  await product.addImage(imagePaths);

  res.json({
    success: true,
    data: { product },
    message: 'Images added successfully'
  });
};

export const updateImage = async (req: Request, res: Response) => {
  const { id, imageId } = req.params;
  const { url, alt, isPrimary } = req.body;

  const product = await Product.findById(id);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  await product.updateImage(imageId, { url, alt, isPrimary });

  res.json({
    success: true,
    data: { product },
    message: 'Image updated successfully'
  });
};

export const removeImage = async (req: Request, res: Response) => {
  const { id, imageId } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  await product.removeImage(imageId);

  res.json({
    success: true,
    data: { product },
    message: 'Image removed successfully'
  });
};

export const setPrimaryImage = async (req: Request, res: Response) => {
  const { id, imageId } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  await product.setPrimaryImage(imageId);

  res.json({
    success: true,
    data: { product },
    message: 'Primary image set successfully'
  });
};
