import mongoose, { Schema, Document } from 'mongoose';
import { IProduct, IProductVariant, IProductImage, IInventoryInfo, ISustainabilityInfo, ISeoInfo } from '../types';

const productImageSchema = new Schema<IProductImage>({
  url: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    required: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  thumbnail: String,
  medium: String,
  large: String
});

const inventoryInfoSchema = new Schema<IInventoryInfo>({
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  availableQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: 0
  },
  isLowStock: {
    type: Boolean,
    default: false
  },
  isOutOfStock: {
    type: Boolean,
    default: true
  },
  location: {
    type: String,
    required: true
  },
  supplier: String,
  reorderPoint: {
    type: Number,
    default: 5,
    min: 0
  },
  reorderQuantity: {
    type: Number,
    default: 50,
    min: 1
  }
});

const productVariantSchema = new Schema<IProductVariant>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  comparePrice: {
    type: Number,
    min: 0
  },
  costPrice: {
    type: Number,
    required: true,
    min: 0
  },
  weight: {
    type: Number,
    min: 0
  },
  dimensions: {
    length: {
      type: Number,
      min: 0
    },
    width: {
      type: Number,
      min: 0
    },
    height: {
      type: Number,
      min: 0
    }
  },
  attributes: {
    type: Map,
    of: Schema.Types.Mixed
  },
  images: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  inventory: {
    type: inventoryInfoSchema,
    required: true
  }
});

const sustainabilityInfoSchema = new Schema<ISustainabilityInfo>({
  isEcoFriendly: {
    type: Boolean,
    default: false
  },
  materials: [String],
  certifications: [String],
  carbonFootprint: {
    type: Number,
    min: 0
  },
  recyclable: {
    type: Boolean,
    default: false
  },
  biodegradable: {
    type: Boolean,
    default: false
  }
});

const seoInfoSchema = new Schema<ISeoInfo>({
  title: {
    type: String,
    required: true,
    maxlength: 60
  },
  description: {
    type: String,
    required: true,
    maxlength: 160
  },
  keywords: [String],
  canonicalUrl: String,
  ogImage: String,
  ogDescription: String
});

const productSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true
  },
  shortDescription: {
    type: String,
    required: [true, 'Short description is required'],
    trim: true,
    maxlength: [500, 'Short description cannot exceed 500 characters']
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    trim: true
  },
  barcode: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  comparePrice: {
    type: Number,
    min: [0, 'Compare price cannot be negative']
  },
  costPrice: {
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price cannot be negative']
  },
  taxRate: {
    type: Number,
    default: 0,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%']
  },
  weight: {
    type: Number,
    required: [true, 'Weight is required'],
    min: [0, 'Weight cannot be negative']
  },
  dimensions: {
    length: {
      type: Number,
      required: [true, 'Length is required'],
      min: [0, 'Length cannot be negative']
    },
    width: {
      type: Number,
      required: [true, 'Width is required'],
      min: [0, 'Width cannot be negative']
    },
    height: {
      type: Number,
      required: [true, 'Height is required'],
      min: [0, 'Height cannot be negative']
    }
  },
  variants: [productVariantSchema],
  images: [productImageSchema],
  videos: [String],
  documents: [String],
  specifications: {
    type: Map,
    of: Schema.Types.Mixed
  },
  features: [String],
  materials: [String],
  careInstructions: [String],
  sustainability: {
    type: sustainabilityInfoSchema,
    default: () => ({})
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  wishlistCount: {
    type: Number,
    default: 0,
    min: 0
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isBestSeller: {
    type: Boolean,
    default: false
  },
  isNewArrival: {
    type: Boolean,
    default: false
  },
  isOnSale: {
    type: Boolean,
    default: false
  },
  saleStartDate: Date,
  saleEndDate: Date,
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  inventory: {
    type: inventoryInfoSchema,
    required: true
  },
  seo: {
    type: seoInfoSchema,
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for final price (with discount)
productSchema.virtual('finalPrice').get(function() {
  if (this.isOnSale && this.discountPercentage && this.discountPercentage > 0) {
    return this.price - (this.price * this.discountPercentage / 100);
  }
  return this.price;
});

// Virtual for discount amount
productSchema.virtual('discountAmount').get(function() {
  if (this.isOnSale && this.discountPercentage && this.discountPercentage > 0) {
    return this.price * this.discountPercentage / 100;
  }
  return 0;
});

// Virtual for is sale active
productSchema.virtual('isSaleActive').get(function() {
  if (!this.isOnSale || !this.saleStartDate || !this.saleEndDate) {
    return false;
  }
  const now = new Date();
  return now >= this.saleStartDate && now <= this.saleEndDate;
});

// Virtual for primary image
productSchema.virtual('primaryImage').get(function() {
  const primaryImg = this.images.find(img => img.isPrimary);
  return primaryImg ? primaryImg.url : (this.images[0] ? this.images[0].url : null);
});

// Indexes
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ sku: 1 });
productSchema.index({ category: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isOnSale: 1 });
productSchema.index({ 'inventory.isOutOfStock': 1 });
productSchema.index({ 'ratings.average': -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ viewCount: -1 });
productSchema.index({ wishlistCount: -1 });

// Pre-save middleware to update inventory status
productSchema.pre('save', function(next) {
  if (this.inventory) {
    this.inventory.availableQuantity = this.inventory.quantity - this.inventory.reservedQuantity;
    this.inventory.isOutOfStock = this.inventory.availableQuantity <= 0;
    this.inventory.isLowStock = this.inventory.availableQuantity <= this.inventory.lowStockThreshold;
  }
  next();
});

// Pre-save middleware to handle primary image
productSchema.pre('save', function(next) {
  if (this.images && this.images.length > 0) {
    const primaryImages = this.images.filter(img => img.isPrimary);
    if (primaryImages.length > 1) {
      // If multiple primary images, keep only the first one
      for (let i = 1; i < primaryImages.length; i++) {
        primaryImages[i].isPrimary = false;
      }
    }
  }
  next();
});

// Static method to find active products
productSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find featured products
productSchema.statics.findFeatured = function(limit = 10) {
  return this.find({ isActive: true, isFeatured: true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find best sellers
productSchema.statics.findBestSellers = function(limit = 10) {
  return this.find({ isActive: true, isBestSeller: true })
    .sort({ 'ratings.average': -1, viewCount: -1 })
    .limit(limit);
};

// Static method to find new arrivals
productSchema.statics.findNewArrivals = function(limit = 10) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.find({ 
    isActive: true, 
    isNewArrival: true,
    createdAt: { $gte: thirtyDaysAgo }
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find on sale products
productSchema.statics.findOnSale = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    isOnSale: true,
    saleStartDate: { $lte: now },
    saleEndDate: { $gte: now }
  });
};

// Static method to search products
productSchema.statics.search = function(query: string, options: any = {}) {
  const searchQuery: any = {
    isActive: true,
    $text: { $search: query }
  };

  if (options.category) searchQuery.category = options.category;
  if (options.subcategory) searchQuery.subcategory = options.subcategory;
  if (options.brand) searchQuery.brand = options.brand;
  if (options.minPrice) searchQuery.price = { $gte: options.minPrice };
  if (options.maxPrice) searchQuery.price = { ...searchQuery.price, $lte: options.maxPrice };
  if (options.rating) searchQuery['ratings.average'] = { $gte: options.rating };

  return this.find(searchQuery)
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

// Method to increment view count
productSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to increment wishlist count
productSchema.methods.incrementWishlistCount = function() {
  this.wishlistCount += 1;
  return this.save();
};

// Method to decrement wishlist count
productSchema.methods.decrementWishlistCount = function() {
  if (this.wishlistCount > 0) {
    this.wishlistCount -= 1;
  }
  return this.save();
};

// Method to update ratings
productSchema.methods.updateRatings = function(newRating: number) {
  const totalRating = this.ratings.average * this.ratings.count + newRating;
  this.ratings.count += 1;
  this.ratings.average = totalRating / this.ratings.count;
  return this.save();
};

// Method to add variant
productSchema.methods.addVariant = function(variant: IProductVariant) {
  this.variants.push(variant);
  return this.save();
};

// Method to update variant
productSchema.methods.updateVariant = function(variantId: string, updates: Partial<IProductVariant>) {
  const variant = this.variants.id(variantId);
  if (!variant) {
    throw new Error('Variant not found');
  }
  Object.assign(variant, updates);
  return this.save();
};

// Method to remove variant
productSchema.methods.removeVariant = function(variantId: string) {
  this.variants = this.variants.filter(variant => variant._id.toString() !== variantId);
  return this.save();
};

// Method to add image
productSchema.methods.addImage = function(image: IProductImage) {
  if (image.isPrimary) {
    // Remove primary from other images
    this.images.forEach(img => img.isPrimary = false);
  }
  this.images.push(image);
  return this.save();
};

// Method to update image
productSchema.methods.updateImage = function(imageId: string, updates: Partial<IProductImage>) {
  const image = this.images.id(imageId);
  if (!image) {
    throw new Error('Image not found');
  }
  
  if (updates.isPrimary) {
    // Remove primary from other images
    this.images.forEach(img => img.isPrimary = false);
  }
  
  Object.assign(image, updates);
  return this.save();
};

// Method to remove image
productSchema.methods.removeImage = function(imageId: string) {
  this.images = this.images.filter(img => img._id.toString() !== imageId);
  return this.save();
};

// Method to set primary image
productSchema.methods.setPrimaryImage = function(imageId: string) {
  this.images.forEach(img => img.isPrimary = img._id.toString() === imageId);
  return this.save();
};

export const Product = mongoose.model<IProduct>('Product', productSchema);
