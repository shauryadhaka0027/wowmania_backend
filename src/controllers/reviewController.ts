import { Request, Response } from 'express';
import { Review } from '../models/Review';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const getProductReviews = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', rating, verified } = req.query;

  // Validate product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  const options = {
    page: Number(page),
    limit: Number(limit),
    sortBy: sortBy as string,
    sortOrder: sortOrder as string,
    rating: rating ? Number(rating) : undefined,
    verified: verified === 'true'
  };

  const reviews = await Review.findByProduct(productId, options);

  res.json({
    success: true,
    data: { reviews },
    message: 'Product reviews retrieved successfully'
  });
};

export const getUserReviews = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { page = 1, limit = 10 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [reviews, total] = await Promise.all([
    Review.find({ userId, isApproved: true })
      .populate('productId', 'name images price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Review.countDocuments({ userId, isApproved: true })
  ]);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    },
    message: 'User reviews retrieved successfully'
  });
};

export const createReview = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { productId, rating, title, comment, orderId } = req.body;
  const images = (req.files as Express.Multer.File[]) || [];

  // Validate product exists and is active
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw createNotFoundError('Product not found or unavailable');
  }

  // Check if user has already reviewed this product
  const existingReview = await Review.findOne({ userId, productId });
  if (existingReview) {
    throw createValidationError('You have already reviewed this product');
  }

  // Verify purchase if orderId is provided
  let isVerified = false;
  if (orderId) {
    const order = await Order.findOne({ 
      _id: orderId, 
      userId,
      status: 'delivered'
    });
    
    if (order) {
      const hasProduct = order.items.some(item => 
        item.productId.toString() === productId
      );
      if (hasProduct) {
        isVerified = true;
      }
    }
  }

  // Handle image uploads
  const imageUrls = images.map(file => file.path);

  const review = new Review({
    productId,
    userId,
    orderId,
    rating,
    title,
    comment,
    images: imageUrls,
    isVerified
  });

  await review.save();

  // Update product ratings
  await product.updateRatings();

  logger.info('Review created', { 
    reviewId: review._id, 
    productId, 
    userId,
    rating 
  });

  res.status(201).json({
    success: true,
    data: { review },
    message: 'Review created successfully'
  });
};

export const updateReview = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const { rating, title, comment } = req.body;
  const images = (req.files as Express.Multer.File[]) || [];

  const review = await Review.findOne({ _id: id, userId });
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  if (!review.isApproved) {
    throw createValidationError('Cannot update review that is not approved');
  }

  // Update fields
  if (rating !== undefined) review.rating = rating;
  if (title !== undefined) review.title = title;
  if (comment !== undefined) review.comment = comment;

  // Handle new images
  if (images.length > 0) {
    const newImageUrls = images.map(file => file.path);
    review.images = [...(review.images || []), ...newImageUrls];
  }

  await review.save();

  // Update product ratings
  const product = await Product.findById(review.productId);
  if (product) {
    await product.updateRatings();
  }

  logger.info('Review updated', { reviewId: id, userId });

  res.json({
    success: true,
    data: { review },
    message: 'Review updated successfully'
  });
};

export const deleteReview = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const review = await Review.findOne({ _id: id, userId });
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  const productId = review.productId;

  await Review.findByIdAndDelete(id);

  // Update product ratings
  const product = await Product.findById(productId);
  if (product) {
    await product.updateRatings();
  }

  logger.info('Review deleted', { reviewId: id, userId });

  res.json({
    success: true,
    message: 'Review deleted successfully'
  });
};

export const markHelpful = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  await review.markHelpful(userId);

  res.json({
    success: true,
    data: { review },
    message: 'Review marked as helpful'
  });
};

export const unmarkHelpful = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  await review.unmarkHelpful(userId);

  res.json({
    success: true,
    data: { review },
    message: 'Review unmarked as helpful'
  });
};

export const reportReview = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const { reason } = req.body;

  const review = await Review.findById(id);
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  if (review.userId.toString() === userId) {
    throw createValidationError('Cannot report your own review');
  }

  await review.report(reason, userId);

  logger.info('Review reported', { 
    reviewId: id, 
    reportedBy: userId, 
    reason 
  });

  res.json({
    success: true,
    message: 'Review reported successfully'
  });
};

// Admin functions
export const getReportedReviews = async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [reviews, total] = await Promise.all([
    Review.find({ isReported: true })
      .populate('userId', 'firstName lastName email')
      .populate('productId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Review.countDocuments({ isReported: true })
  ]);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    },
    message: 'Reported reviews retrieved successfully'
  });
};

export const approveReview = async (req: Request, res: Response) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  await review.approve();

  // Update product ratings
  const product = await Product.findById(review.productId);
  if (product) {
    await product.updateRatings();
  }

  logger.info('Review approved', { reviewId: id, approvedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { review },
    message: 'Review approved successfully'
  });
};

export const rejectReview = async (req: Request, res: Response) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw createNotFoundError('Review not found');
  }

  await review.reject();

  // Update product ratings
  const product = await Product.findById(review.productId);
  if (product) {
    await product.updateRatings();
  }

  logger.info('Review rejected', { reviewId: id, rejectedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { review },
    message: 'Review rejected successfully'
  });
};

export const getProductReviewStats = async (req: Request, res: Response) => {
  const { productId } = req.params;

  // Validate product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw createNotFoundError('Product not found');
  }

  const stats = await Review.getProductStats(productId);

  res.json({
    success: true,
    data: { stats },
    message: 'Product review statistics retrieved successfully'
  });
};
