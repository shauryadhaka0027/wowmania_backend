import { Request, Response } from 'express';
import { Category } from '../models/Category';
import { createNotFoundError, createValidationError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const getAllCategories = async (req: Request, res: Response) => {
  const { page = 1, limit = 20, featured, tree } = req.query;

  const filter: any = { isActive: true };
  if (featured === 'true') {
    filter.isFeatured = true;
  }

  const skip = (Number(page) - 1) * Number(limit);

  if (tree === 'true') {
    // Return hierarchical tree structure
    const categories = await Category.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const treeData = (Category as any).buildTree(categories);

    res.json({
      success: true,
      data: { categories: treeData },
      message: 'Categories tree retrieved successfully'
    });
  } else {
    // Return flat list with pagination
    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort({ sortOrder: 1, name: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Category.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        categories,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      },
      message: 'Categories retrieved successfully'
    });
  }
};

export const getFeaturedCategories = async (req: Request, res: Response) => {
  const { limit = 8 } = req.query;

  const categories = await Category.find({ isActive: true, isFeatured: true })
    .sort({ sortOrder: 1, name: 1 })
    .limit(Number(limit))
    .lean();

  res.json({
    success: true,
    data: { categories },
    message: 'Featured categories retrieved successfully'
  });
};

export const getRootCategories = async (req: Request, res: Response) => {
  const categories = await Category.find({ isActive: true, level: 0 })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  res.json({
    success: true,
    data: { categories },
    message: 'Root categories retrieved successfully'
  });
};

export const getCategoryById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await Category.findById(id).lean();
  if (!category) {
    throw createNotFoundError('Category not found');
  }

  res.json({
    success: true,
    data: { category },
    message: 'Category retrieved successfully'
  });
};

export const getCategoryBySlug = async (req: Request, res: Response) => {
  const { slug } = req.params;

  const category = await Category.findOne({ slug, isActive: true }).lean();
  if (!category) {
    throw createNotFoundError('Category not found');
  }

  res.json({
    success: true,
    data: { category },
    message: 'Category retrieved successfully'
  });
};

export const getCategoryChildren = async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    throw createNotFoundError('Category not found');
  }

  const children = await category.getChildren();

  res.json({
    success: true,
    data: { children },
    message: 'Category children retrieved successfully'
  });
};

export const getCategoryAncestors = async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    throw createNotFoundError('Category not found');
  }

  const ancestors = await category.getAncestors();

  res.json({
    success: true,
    data: { ancestors },
    message: 'Category ancestors retrieved successfully'
  });
};

export const getCategoryDescendants = async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    throw createNotFoundError('Category not found');
  }

  const descendants = await category.getDescendants();

  res.json({
    success: true,
    data: { descendants },
    message: 'Category descendants retrieved successfully'
  });
};

export const createCategory = async (req: Request, res: Response) => {
  const categoryData = req.body;
  const image = req.file;

  if (image) {
    categoryData.image = image.path;
  }

  const category = new Category(categoryData);
  await category.save();

  logger.info('Category created', { categoryId: category._id, createdBy: (req as any).user.id });

  res.status(201).json({
    success: true,
    data: { category },
    message: 'Category created successfully'
  });
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  const image = req.file;

  const category = await Category.findById(id);
  if (!category) {
    throw createNotFoundError('Category not found');
  }

  if (image) {
    updateData.image = image.path;
  }

  Object.assign(category, updateData);
  await category.save();

  logger.info('Category updated', { categoryId: id, updatedBy: (req as any).user.id });

  res.json({
    success: true,
    data: { category },
    message: 'Category updated successfully'
  });
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    throw createNotFoundError('Category not found');
  }

  // Check if category has children
  const children = await category.getChildren();
  if (children.length > 0) {
    throw createValidationError('Cannot delete category with children. Please move or delete children first.');
  }

  // Check if category has products (you might want to add this check)
  // const productCount = await Product.countDocuments({ category: id });
  // if (productCount > 0) {
  //   throw createValidationError('Cannot delete category with products. Please move or delete products first.');
  // }

  // Soft delete
  category.isActive = false;
  await category.save();

  logger.info('Category deleted', { categoryId: id, deletedBy: (req as any).user.id });

  res.json({
    success: true,
    message: 'Category deleted successfully'
  });
};

export const moveCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newParentId } = req.body;

  const category = await Category.findById(id);
  if (!category) {
    throw createNotFoundError('Category not found');
  }

  let newParent = null;
  if (newParentId) {
    newParent = await Category.findById(newParentId);
    if (!newParent) {
      throw createNotFoundError('Parent category not found');
    }
  }

  await category.moveTo(newParentId || undefined);

  logger.info('Category moved', { 
    categoryId: id, 
    newParentId, 
    movedBy: (req as any).user.id 
  });

  res.json({
    success: true,
    data: { category },
    message: 'Category moved successfully'
  });
};

export const reorderCategories = async (req: Request, res: Response) => {
  const { categoryOrders } = req.body;

  if (!Array.isArray(categoryOrders)) {
    throw createValidationError('Category orders must be an array');
  }

  // Update sort order for each category
  for (const { id, sortOrder } of categoryOrders) {
    await Category.findByIdAndUpdate(id, { sortOrder });
  }

  logger.info('Categories reordered', { 
    categoryCount: categoryOrders.length, 
    reorderedBy: (req as any).user.id 
  });

  res.json({
    success: true,
    message: 'Categories reordered successfully'
  });
};
