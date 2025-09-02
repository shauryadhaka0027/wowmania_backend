import mongoose from 'mongoose';
import { logger } from './logger';
import { config } from './env';

let isConnected = false;

export const connectDB = async (): Promise<void> => {
  if (isConnected) {
    logger.info('Database already connected');
    return;
  }

  try {
    console.log('config.mongodb.uri', config.mongodb.uri);
    const mongoUri = config.mongodb.uri;
    
    if (!mongoUri) {
      throw new Error('MongoDB URI is not defined');
    }

   

    await mongoose.connect(mongoUri);

    isConnected = true;
    logger.info('✅ MongoDB connected successfully');

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = false;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        logger.error('Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error);
  }
};

export const getConnectionStatus = (): boolean => {
  return isConnected;
};
