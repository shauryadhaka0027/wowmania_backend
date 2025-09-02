import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
  helpful: number;
  helpfulUsers: mongoose.Types.ObjectId[];
  isVerified: boolean;
  isApproved: boolean;
  isReported: boolean;
  reportReason?: string;
  reportedBy?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  
  // Virtuals
  helpfulPercentage: number;
  isHelpful: boolean;
  
  // Instance methods
  markHelpful(userId: string): Promise<void>;
  unmarkHelpful(userId: string): Promise<void>;
  report(reason: string, reportedBy: string): Promise<void>;
  approve(): Promise<void>;
  reject(): Promise<void>;
}

const reviewSchema = new Schema<IReview>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Review title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    minlength: [10, 'Review comment must be at least 10 characters'],
    maxlength: [1000, 'Review comment cannot exceed 1000 characters']
  },
  images: [{
    type: String,
    trim: true
  }],
  helpful: {
    type: Number,
    default: 0,
    min: [0, 'Helpful count cannot be negative']
  },
  helpfulUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  isReported: {
    type: Boolean,
    default: false
  },
  reportReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Report reason cannot exceed 500 characters']
  },
  reportedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ isApproved: 1 });
reviewSchema.index({ isVerified: 1 });
reviewSchema.index({ helpful: -1 });

// Virtuals
reviewSchema.virtual('helpfulPercentage').get(function(this: IReview) {
  return this.helpful > 0 ? Math.round((this.helpful / (this.helpful + 1)) * 100) : 0;
});

// Instance methods
reviewSchema.methods.markHelpful = async function(this: IReview, userId: string): Promise<void> {
  const userIdObj = new mongoose.Types.ObjectId(userId);
  
  if (!this.helpfulUsers.includes(userIdObj)) {
    this.helpfulUsers.push(userIdObj);
    this.helpful += 1;
    await this.save();
  }
};

reviewSchema.methods.unmarkHelpful = async function(this: IReview, userId: string): Promise<void> {
  const userIdObj = new mongoose.Types.ObjectId(userId);
  const index = this.helpfulUsers.indexOf(userIdObj);
  
  if (index > -1) {
    this.helpfulUsers.splice(index, 1);
    this.helpful = Math.max(0, this.helpful - 1);
    await this.save();
  }
};

reviewSchema.methods.report = async function(this: IReview, reason: string, reportedBy: string): Promise<void> {
  const reportedByObj = new mongoose.Types.ObjectId(reportedBy);
  
  if (!this.reportedBy?.includes(reportedByObj)) {
    this.isReported = true;
    this.reportReason = reason;
    if (!this.reportedBy) {
      this.reportedBy = [];
    }
    this.reportedBy.push(reportedByObj);
    await this.save();
  }
};

reviewSchema.methods.approve = async function(this: IReview): Promise<void> {
  this.isApproved = true;
  this.isReported = false;
  delete (this as any).reportReason;
  this.reportedBy = [];
  await this.save();
};

reviewSchema.methods.reject = async function(this: IReview): Promise<void> {
  this.isApproved = false;
  await this.save();
};

// Static methods
reviewSchema.statics.findByProduct = async function(productId: string, options: any = {}): Promise<IReview[]> {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', rating, verified } = options;
  
  const filter: any = { productId, isApproved: true };
  if (rating) filter.rating = rating;
  if (verified) filter.isVerified = verified;
  
  const sort: any = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  const skip = (page - 1) * limit;
  
  return await this.find(filter)
    .populate('user', 'firstName lastName avatar')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

reviewSchema.statics.findByUser = async function(userId: string): Promise<IReview[]> {
  return await this.find({ userId, isApproved: true })
    .populate('product', 'name images price')
    .sort({ createdAt: -1 })
    .lean();
};

reviewSchema.statics.getProductStats = async function(productId: string): Promise<any> {
  const stats = await this.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), isApproved: true } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  stats[0].ratingDistribution.forEach((rating: number) => {
    ratingDistribution[rating as keyof typeof ratingDistribution]++;
  });

  return {
    totalReviews: stats[0].totalReviews,
    averageRating: Math.round(stats[0].averageRating * 10) / 10,
    ratingDistribution
  };
};

reviewSchema.statics.findReported = async function(): Promise<IReview[]> {
  return await this.find({ isReported: true })
    .populate('user', 'firstName lastName email')
    .populate('product', 'name')
    .sort({ createdAt: -1 })
    .lean();
};

export const Review = mongoose.model<IReview>('Review', reviewSchema);

