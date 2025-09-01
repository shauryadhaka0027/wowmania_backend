import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';
import { config } from './env';

let redisClient: RedisClientType | null = null;
let isConnected = false;

export const connectRedis = async (): Promise<void> => {
  if (isConnected && redisClient) {
    logger.info('Redis already connected');
    return;
  }

  try {
    redisClient = createClient({
      url: config.redis.url,
      password: config.redis.password,
      socket: {
        connectTimeout: 10000,
        lazyConnect: true,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis max reconnection attempts reached');
            return new Error('Redis max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis connected successfully');
      isConnected = true;
    });

    redisClient.on('end', () => {
      logger.warn('Redis client disconnected');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    await redisClient.connect();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        if (redisClient) {
          await redisClient.quit();
          logger.info('Redis connection closed through app termination');
        }
        process.exit(0);
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    // Don't exit process for Redis connection failure
    // The app can still function without Redis
  }
};

export const getRedisClient = (): RedisClientType | null => {
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient) {
      await redisClient.quit();
      isConnected = false;
      logger.info('Redis disconnected');
    }
  } catch (error) {
    logger.error('Error disconnecting Redis:', error);
  }
};

export const getConnectionStatus = (): boolean => {
  return isConnected;
};

// Redis utility functions
export const setCache = async (key: string, value: any, ttl?: number): Promise<void> => {
  try {
    if (!redisClient || !isConnected) {
      return;
    }
    
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await redisClient.setEx(key, ttl, serializedValue);
    } else {
      await redisClient.set(key, serializedValue);
    }
  } catch (error) {
    logger.error('Error setting cache:', error);
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    if (!redisClient || !isConnected) {
      return null;
    }
    
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Error getting cache:', error);
    return null;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    if (!redisClient || !isConnected) {
      return;
    }
    
    await redisClient.del(key);
  } catch (error) {
    logger.error('Error deleting cache:', error);
  }
};

export const clearCache = async (): Promise<void> => {
  try {
    if (!redisClient || !isConnected) {
      return;
    }
    
    await redisClient.flushDb();
    logger.info('Cache cleared');
  } catch (error) {
    logger.error('Error clearing cache:', error);
  }
};


