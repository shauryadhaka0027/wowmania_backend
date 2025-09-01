import mongoose, { Document, Schema } from 'mongoose';
import slugify from 'slugify';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent?: mongoose.Types.ObjectId;
  ancestors: mongoose.Types.ObjectId[];
  level: number;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  metaTitle?: string;
  metaDescription?: string;
  seoKeywords?: string[];
  createdAt: Date;
  updatedAt: Date;
  
  // Virtuals
  fullPath: string;
  childrenCount: number;
  productsCount: number;
  
  // Instance methods
  getChildren(): Promise<ICategory[]>;
  getAncestors(): Promise<ICategory[]>;
  getDescendants(): Promise<ICategory[]>;
  moveTo(newParent?: mongoose.Types.ObjectId): Promise<void>;
  updateAncestors(): Promise<void>;
  
  // Static methods
  findBySlug(slug: string): Promise<ICategory | null>;
  findActive(): Promise<ICategory[]>;
  findFeatured(): Promise<ICategory[]>;
  findRootCategories(): Promise<ICategory[]>;
  findWithChildren(): Promise<ICategory[]>;
  buildTree(categories: ICategory[]): any[];
}

const categorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    type: String,
    trim: true
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  ancestors: [{
    type: Schema.Types.ObjectId,
    ref: 'Category'
  }],
  level: {
    type: Number,
    default: 0,
    min: [0, 'Level cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  metaTitle: {
    type: String,
    trim: true,
    maxlength: [60, 'Meta title cannot exceed 60 characters']
  },
  metaDescription: {
    type: String,
    trim: true,
    maxlength: [160, 'Meta description cannot exceed 160 characters']
  },
  seoKeywords: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ ancestors: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ isFeatured: 1 });
categorySchema.index({ sortOrder: 1 });

// Virtuals
categorySchema.virtual('fullPath').get(function(this: ICategory) {
  return this.ancestors.map(ancestor => ancestor.toString()).concat(this._id.toString()).join('/');
});

categorySchema.virtual('childrenCount', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
  count: true
});

categorySchema.virtual('productsCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Pre-save middleware
categorySchema.pre('save', async function(next) {
  // Generate slug if not provided
  if (!this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  
  // Update ancestors and level if parent changes
  if (this.isModified('parent')) {
    await this.updateAncestors();
  }
  
  // Set meta title and description if not provided
  if (!this.metaTitle) {
    this.metaTitle = this.name;
  }
  
  if (!this.metaDescription) {
    this.metaDescription = this.description || this.name;
  }
  
  next();
});

// Pre-remove middleware
categorySchema.pre('remove', async function(next) {
  // Move children to parent or make them root categories
  const children = await this.model('Category').find({ parent: this._id });
  for (const child of children) {
    child.parent = this.parent;
    await child.save();
  }
  
  // Remove category from products (set to null or default category)
  await this.model('Product').updateMany(
    { category: this._id },
    { category: null }
  );
  
  next();
});

// Instance methods
categorySchema.methods.getChildren = async function(this: ICategory): Promise<ICategory[]> {
  return await this.model('Category').find({ parent: this._id, isActive: true }).sort({ sortOrder: 1, name: 1 });
};

categorySchema.methods.getAncestors = async function(this: ICategory): Promise<ICategory[]> {
  if (this.ancestors.length === 0) return [];
  return await this.model('Category').find({ _id: { $in: this.ancestors } }).sort({ level: 1 });
};

categorySchema.methods.getDescendants = async function(this: ICategory): Promise<ICategory[]> {
  return await this.model('Category').find({ ancestors: this._id, isActive: true }).sort({ sortOrder: 1, name: 1 });
};

categorySchema.methods.moveTo = async function(this: ICategory, newParent?: mongoose.Types.ObjectId): Promise<void> {
  this.parent = newParent || null;
  await this.updateAncestors();
  await this.save();
};

categorySchema.methods.updateAncestors = async function(this: ICategory): Promise<void> {
  if (!this.parent) {
    this.ancestors = [];
    this.level = 0;
  } else {
    const parent = await this.model('Category').findById(this.parent);
    if (!parent) {
      throw new Error('Parent category not found');
    }
    
    this.ancestors = [...parent.ancestors, parent._id];
    this.level = parent.level + 1;
  }
};

// Static methods
categorySchema.statics.findBySlug = async function(slug: string): Promise<ICategory | null> {
  return await this.findOne({ slug, isActive: true });
};

categorySchema.statics.findActive = async function(): Promise<ICategory[]> {
  return await this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

categorySchema.statics.findFeatured = async function(): Promise<ICategory[]> {
  return await this.find({ isActive: true, isFeatured: true }).sort({ sortOrder: 1, name: 1 });
};

categorySchema.statics.findRootCategories = async function(): Promise<ICategory[]> {
  return await this.find({ parent: null, isActive: true }).sort({ sortOrder: 1, name: 1 });
};

categorySchema.statics.findWithChildren = async function(): Promise<ICategory[]> {
  return await this.find({ isActive: true })
    .populate('childrenCount')
    .populate('productsCount')
    .sort({ sortOrder: 1, name: 1 });
};

categorySchema.statics.buildTree = function(categories: ICategory[]): any[] {
  const categoryMap = new Map();
  const tree: any[] = [];
  
  // Create a map of all categories
  categories.forEach(category => {
    categoryMap.set(category._id.toString(), {
      ...category.toObject(),
      children: []
    });
  });
  
  // Build the tree structure
  categories.forEach(category => {
    const categoryNode = categoryMap.get(category._id.toString());
    
    if (category.parent) {
      const parent = categoryMap.get(category.parent.toString());
      if (parent) {
        parent.children.push(categoryNode);
      }
    } else {
      tree.push(categoryNode);
    }
  });
  
  return tree;
};

export const Category = mongoose.model<ICategory>('Category', categorySchema);
