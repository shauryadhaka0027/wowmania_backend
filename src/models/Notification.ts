import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'order_status' | 'payment' | 'shipping' | 'promotion' | 'review' | 'wishlist' | 'system' | 'security';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  isArchived: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expiresAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtuals
  isExpired: boolean;
  timeAgo: string;
  
  // Instance methods
  markAsRead(): Promise<void>;
  markAsUnread(): Promise<void>;
  archive(): Promise<void>;
  unarchive(): Promise<void>;
}

const notificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['order_status', 'payment', 'shipping', 'promotion', 'review', 'wishlist', 'system', 'security'],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, isArchived: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtuals
notificationSchema.virtual('isExpired').get(function(this: INotification) {
  return this.expiresAt ? new Date() > this.expiresAt : false;
});

notificationSchema.virtual('timeAgo').get(function(this: INotification) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - this.createdAt.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  return `${Math.floor(diffInSeconds / 31536000)}y ago`;
});

// Instance methods
notificationSchema.methods.markAsRead = async function(this: INotification): Promise<void> {
  this.isRead = true;
  this.readAt = new Date();
  await this.save();
};

notificationSchema.methods.markAsUnread = async function(this: INotification): Promise<void> {
  this.isRead = false;
  this.readAt = undefined;
  await this.save();
};

notificationSchema.methods.archive = async function(this: INotification): Promise<void> {
  this.isArchived = true;
  await this.save();
};

notificationSchema.methods.unarchive = async function(this: INotification): Promise<void> {
  this.isArchived = false;
  await this.save();
};

// Static methods
notificationSchema.statics.findByUser = async function(userId: string, options: any = {}): Promise<INotification[]> {
  const { page = 1, limit = 20, type, isRead, isArchived, priority } = options;
  
  const filter: any = { userId };
  if (type) filter.type = type;
  if (isRead !== undefined) filter.isRead = isRead;
  if (isArchived !== undefined) filter.isArchived = isArchived;
  if (priority) filter.priority = priority;
  
  const skip = (page - 1) * limit;
  
  return await this.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

notificationSchema.statics.getUnreadCount = async function(userId: string): Promise<number> {
  return await this.countDocuments({ userId, isRead: false, isArchived: false });
};

notificationSchema.statics.markAllAsRead = async function(userId: string): Promise<void> {
  await this.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

notificationSchema.statics.createOrderStatusNotification = async function(
  userId: string,
  orderNumber: string,
  status: string,
  data?: any
): Promise<INotification> {
  const title = `Order ${orderNumber} Status Update`;
  const message = `Your order ${orderNumber} has been updated to ${status}.`;
  
  return await this.create({
    userId,
    type: 'order_status',
    title,
    message,
    data: { orderNumber, status, ...data },
    priority: status === 'delivered' ? 'high' : 'medium'
  });
};

notificationSchema.statics.createPaymentNotification = async function(
  userId: string,
  orderNumber: string,
  status: string,
  amount: number,
  data?: any
): Promise<INotification> {
  const title = `Payment ${status.charAt(0).toUpperCase() + status.slice(1)}`;
  const message = `Payment for order ${orderNumber} ($${amount.toFixed(2)}) has been ${status}.`;
  
  return await this.create({
    userId,
    type: 'payment',
    title,
    message,
    data: { orderNumber, status, amount, ...data },
    priority: status === 'failed' ? 'urgent' : 'medium'
  });
};

notificationSchema.statics.createPromotionNotification = async function(
  userId: string,
  title: string,
  message: string,
  data?: any
): Promise<INotification> {
  return await this.create({
    userId,
    type: 'promotion',
    title,
    message,
    data,
    priority: 'medium',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  });
};

notificationSchema.statics.createSystemNotification = async function(
  userId: string,
  title: string,
  message: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  data?: any
): Promise<INotification> {
  return await this.create({
    userId,
    type: 'system',
    title,
    message,
    data,
    priority
  });
};

notificationSchema.statics.createSecurityNotification = async function(
  userId: string,
  title: string,
  message: string,
  data?: any
): Promise<INotification> {
  return await this.create({
    userId,
    type: 'security',
    title,
    message,
    data,
    priority: 'high'
  });
};

notificationSchema.statics.cleanupExpired = async function(): Promise<void> {
  await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
