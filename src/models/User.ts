import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { IUser, IAddress, IUserPreferences, ISocialLogin } from '../types';

const addressSchema = new Schema<IAddress>({
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  addressLine1: {
    type: String,
    required: true,
    trim: true
  },
  addressLine2: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  postalCode: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  landmark: {
    type: String,
    trim: true
  }
}, { _id: true });

const userPreferencesSchema = new Schema<IUserPreferences>({
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'hi', 'bn', 'ta', 'te', 'ml', 'kn', 'mr', 'gu', 'pa']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  marketingEmails: {
    type: Boolean,
    default: true
  },
  pushNotifications: {
    type: Boolean,
    default: true
  },
  smsNotifications: {
    type: Boolean,
    default: false
  },
  theme: {
    type: String,
    default: 'light',
    enum: ['light', 'dark']
  }
});

const socialLoginSchema = new Schema<ISocialLogin>({
  provider: {
    type: String,
    required: true,
    enum: ['google', 'facebook']
  },
  providerId: {
    type: String,
    required: true
  },
  accessToken: String,
  refreshToken: String
});

const userSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value: Date) {
        return !value || value < new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  profileImage: {
    type: String,
    default: 'default-avatar.png'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['customer', 'admin', 'super_admin'],
    default: 'customer'
  },
  addresses: [addressSchema],
  preferences: {
    type: userPreferencesSchema,
    default: () => ({})
  },
  socialLogin: socialLoginSchema,
  twoFactorSecret: {
    type: String,
    select: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for isLocked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(config.security.bcryptRounds));
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-save middleware to handle address defaults
userSchema.pre('save', function(next) {
  if (this.addresses && this.addresses.length > 0) {
    const defaultAddresses = this.addresses.filter(addr => addr.isDefault);
    if (defaultAddresses.length > 1) {
      // If multiple default addresses, keep only the first one
      for (let i = 1; i < defaultAddresses.length; i++) {
        const addr = defaultAddresses[i];
        if (addr) {
          addr.isDefault = false;
        }
      }
    }
  }
  next();
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to generate auth token
userSchema.methods.generateAuthToken = function(): string {
  return jwt.sign(
    { userId: this._id, email: this.email, role: this.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// Instance method to generate refresh token
userSchema.methods.generateRefreshToken = function(): string {
  return jwt.sign(
    { userId: this._id, tokenVersion: this.loginAttempts },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

// Static method to find by email
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find by role
userSchema.statics.findByRole = function(role: string) {
  return this.find({ role, isActive: true });
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !(this as any).isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to add address
userSchema.methods.addAddress = function(address: IAddress) {
  if (address.isDefault) {
    // Remove default from other addresses
    this.addresses.forEach((addr: any) => addr.isDefault = false);
  }
  this.addresses.push(address);
  return this.save();
};

// Method to update address
userSchema.methods.updateAddress = function(addressId: string, updates: Partial<IAddress>) {
  const address = this.addresses.id(addressId);
  if (!address) {
    throw new Error('Address not found');
  }
  
  if (updates.isDefault) {
    // Remove default from other addresses
    this.addresses.forEach((addr: any) => addr.isDefault = false);
  }
  
  Object.assign(address, updates);
  return this.save();
};

// Method to remove address
userSchema.methods.removeAddress = function(addressId: string) {
  this.addresses = this.addresses.filter((addr: any) => addr._id.toString() !== addressId);
  return this.save();
};

// Method to set default address
userSchema.methods.setDefaultAddress = function(addressId: string) {
  this.addresses.forEach((addr: any) => addr.isDefault = addr._id.toString() === addressId);
  return this.save();
};

export const User = mongoose.model<IUser>('User', userSchema);
