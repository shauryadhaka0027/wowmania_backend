import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IWishlistItem {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  notes?: string;
  addedAt: Date;
}

export interface IWishlist extends Document {
  userId: mongoose.Types.ObjectId;
  items: IWishlistItem[];
  shareToken?: string;
  shareExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtuals
  itemCount: number;
  isEmpty: boolean;
  
  // Instance methods
  addItem(item: Partial<IWishlistItem>): Promise<void>;
  removeItem(itemId: string): Promise<void>;
  updateItem(itemId: string, updates: Partial<IWishlistItem>): Promise<void>;
  clearWishlist(): Promise<void>;
  generateShareToken(): string;
  isItemInWishlist(productId: string, variantId?: string): boolean;
}

const wishlistItemSchema = new Schema<IWishlistItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantId: {
    type: Schema.Types.ObjectId,
    ref: 'ProductVariant'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const wishlistSchema = new Schema<IWishlist>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [wishlistItemSchema],
  shareToken: {
    type: String,
    unique: true,
    sparse: true
  },
  shareExpiresAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
wishlistSchema.index({ userId: 1 });
wishlistSchema.index({ shareToken: 1 });
wishlistSchema.index({ 'items.productId': 1 });
wishlistSchema.index({ shareExpiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtuals
wishlistSchema.virtual('itemCount').get(function(this: IWishlist) {
  return this.items.length;
});

wishlistSchema.virtual('isEmpty').get(function(this: IWishlist) {
  return this.items.length === 0;
});

// Instance methods
wishlistSchema.methods.addItem = async function(this: IWishlist, item: Partial<IWishlistItem>): Promise<void> {
  // Check if item already exists
  const existingItem = this.items.find(existing => 
    existing.productId.toString() === item.productId?.toString() &&
    (!item.variantId || existing.variantId?.toString() === item.variantId.toString())
  );

  if (existingItem) {
    throw new Error('Item already exists in wishlist');
  }

  this.items.push({
    productId: item.productId!,
    variantId: item.variantId,
    notes: item.notes,
    addedAt: new Date()
  });

  await this.save();
};

wishlistSchema.methods.removeItem = async function(this: IWishlist, itemId: string): Promise<void> {
  const itemIndex = this.items.findIndex(item => item._id.toString() === itemId);
  
  if (itemIndex === -1) {
    throw new Error('Item not found in wishlist');
  }

  this.items.splice(itemIndex, 1);
  await this.save();
};

wishlistSchema.methods.updateItem = async function(this: IWishlist, itemId: string, updates: Partial<IWishlistItem>): Promise<void> {
  const item = this.items.find(item => item._id.toString() === itemId);
  
  if (!item) {
    throw new Error('Item not found in wishlist');
  }

  // Update allowed fields
  if (updates.notes !== undefined) {
    item.notes = updates.notes;
  }

  await this.save();
};

wishlistSchema.methods.clearWishlist = async function(this: IWishlist): Promise<void> {
  this.items = [];
  await this.save();
};

wishlistSchema.methods.generateShareToken = function(this: IWishlist): string {
  const token = uuidv4();
  this.shareToken = token;
  this.shareExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return token;
};

wishlistSchema.methods.isItemInWishlist = function(this: IWishlist, productId: string, variantId?: string): boolean {
  return this.items.some(item => 
    item.productId.toString() === productId &&
    (!variantId || item.variantId?.toString() === variantId)
  );
};

// Static methods
wishlistSchema.statics.findByUserId = async function(userId: string): Promise<IWishlist | null> {
  return await this.findOne({ userId }).populate('items.productId');
};

wishlistSchema.statics.findByShareToken = async function(token: string): Promise<IWishlist | null> {
  return await this.findOne({ 
    shareToken: token,
    shareExpiresAt: { $gt: new Date() }
  });
};

export const Wishlist = mongoose.model<IWishlist>('Wishlist', wishlistSchema);
