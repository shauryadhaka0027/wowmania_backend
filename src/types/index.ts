import { Request } from 'express';
import { Document } from 'mongoose';

// User related types
export interface IUser extends Document {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  profileImage?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  role: 'customer' | 'admin' | 'super_admin';
  addresses: IAddress[];
  preferences: IUserPreferences;
  socialLogin?: ISocialLogin;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(): string;
}

export interface IAddress {
  _id?: string;
  type: 'home' | 'work' | 'other';
  isDefault: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string;
}

export interface IUserPreferences {
  language: string;
  currency: string;
  timezone: string;
  marketingEmails: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  theme: 'light' | 'dark';
}

export interface ISocialLogin {
  provider: 'google' | 'facebook';
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
}

// Product related types
export interface IProduct extends Document {
  _id: string;
  name: string;
  description: string;
  shortDescription: string;
  brand: string;
  category: string;
  subcategory?: string;
  tags: string[];
  sku: string;
  barcode?: string;
  price: number;
  comparePrice?: number;
  costPrice: number;
  taxRate: number;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  variants: IProductVariant[];
  images: IProductImage[];
  videos?: string[];
  documents?: string[];
  specifications: Record<string, any>;
  features: string[];
  materials: string[];
  careInstructions: string[];
  sustainability: ISustainabilityInfo;
  ratings: {
    average: number;
    count: number;
  };
  reviewCount: number;
  wishlistCount: number;
  viewCount: number;
  isActive: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isOnSale: boolean;
  saleStartDate?: Date;
  saleEndDate?: Date;
  discountPercentage?: number;
  inventory: IInventoryInfo;
  seo: ISeoInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductVariant {
  _id?: string;
  name: string;
  sku: string;
  price: number;
  comparePrice?: number;
  costPrice: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  attributes: Record<string, any>;
  images: string[];
  isActive: boolean;
  inventory: IInventoryInfo;
}

export interface IProductImage {
  _id?: string;
  url: string;
  alt: string;
  isPrimary: boolean;
  order: number;
  thumbnail?: string;
  medium?: string;
  large?: string;
}

export interface IInventoryInfo {
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  location: string;
  supplier?: string;
  reorderPoint: number;
  reorderQuantity: number;
}

export interface ISustainabilityInfo {
  isEcoFriendly: boolean;
  materials: string[];
  certifications: string[];
  carbonFootprint?: number;
  recyclable: boolean;
  biodegradable: boolean;
}

export interface ISeoInfo {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl?: string;
  ogImage?: string;
  ogDescription?: string;
}

// Category related types
export interface ICategory extends Document {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentCategory?: string;
  subcategories: string[];
  isActive: boolean;
  order: number;
  seo: ISeoInfo;
  createdAt: Date;
  updatedAt: Date;
}

// Cart related types
export interface ICart extends Document {
  _id: string;
  userId: string;
  items: ICartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  couponCode?: string;
  couponDiscount?: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICartItem {
  _id?: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  addedAt: Date;
}

// Order related types
export interface IOrder extends Document {
  _id: string;
  orderNumber: string;
  userId: string;
  items: IOrderItem[];
  billingAddress: IAddress;
  shippingAddress: IAddress;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  shippingMethod: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  notes?: string;
  customerNotes?: string;
  adminNotes?: string;
  refundReason?: string;
  refundAmount?: number;
  refundDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderItem {
  _id?: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  totalPrice: number;
  image?: string;
}

// Payment related types
export interface IPayment extends Document {
  _id: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentProvider: string;
  transactionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  gatewayResponse: any;
  refundAmount?: number;
  refundReason?: string;
  refundDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Review related types
export interface IReview extends Document {
  _id: string;
  productId: string;
  userId: string;
  orderId?: string;
  rating: number;
  title?: string;
  comment?: string;
  images?: string[];
  isVerified: boolean;
  isHelpful: number;
  isNotHelpful: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Wishlist related types
export interface IWishlist extends Document {
  _id: string;
  userId: string;
  items: IWishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IWishlistItem {
  _id?: string;
  productId: string;
  variantId?: string;
  addedAt: Date;
}

// Notification related types
export interface INotification extends Document {
  _id: string;
  userId: string;
  type: 'order' | 'payment' | 'shipping' | 'promotion' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  isSent: boolean;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Request with user
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Search and Filter types
export interface ProductSearchQuery extends PaginationQuery {
  q?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  isOnSale?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  materials?: string[];
  colors?: string[];
  sizes?: string[];
  availability?: 'in_stock' | 'out_of_stock' | 'low_stock';
}

// File upload types
export interface IFileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}

// Email types
export interface IEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface IEmailData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

// Socket types
export interface ISocketUser {
  userId: string;
  socketId: string;
  isOnline: boolean;
  lastSeen: Date;
}

// JWT types
export interface IJwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface IJwtRefreshPayload {
  userId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

// Error types
export interface IAppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
}

// Validation types
export interface IValidationError {
  field: string;
  message: string;
  value?: any;
}

// Cache types
export interface ICacheOptions {
  ttl?: number;
  prefix?: string;
  key?: string;
}

// Database types
export interface IDatabaseConnection {
  isConnected: boolean;
  connectionString: string;
  databaseName: string;
}

// Health check types
export interface IHealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  database: IDatabaseConnection;
  redis: {
    isConnected: boolean;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    load: number;
    cores: number;
  };
}


