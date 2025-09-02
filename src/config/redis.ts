// src/config/redis.ts
import Redis, { Redis as RedisType } from 'ioredis';
import { logger } from './logger';
import { config } from './env';

let redisClient: RedisType | null = null;
let isConnected = false;

type RedisInit =
  | { kind: 'url'; url: string; options: Record<string, any> }
  | { kind: 'hostport'; options: Record<string, any> };

const buildRedisInit = (): RedisInit => {
  const rawUrl = (config.redis.url || '').trim();
  const hasScheme = /^rediss?:\/\//i.test(rawUrl);

  // Also allow host/port from env for compatibility
  const host = process.env.REDIS_HOST?.trim();
  const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;
  const username = process.env.REDIS_USERNAME?.trim();
  const password = (config.redis.password || process.env.REDIS_PASSWORD || '').trim() || undefined;

  // Detect TLS via scheme or explicit env
  const isTlsByScheme = hasScheme && rawUrl.toLowerCase().startsWith('rediss://');
  const isTlsByEnv = (process.env.REDIS_TLS || '').toLowerCase() === 'true';
  const wantTLS = isTlsByScheme || isTlsByEnv || false;

  const baseOptions: Record<string, any> = {
    // connection + retry options
    lazyConnect: true,
    connectTimeout: 10000,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (hasScheme) {
    // URL path; ioredis accepts URL + options
    const u = new URL(rawUrl);
    const options = {
      ...baseOptions,
      username: username || u.username || undefined,
      password: password || u.password || undefined,
      tls: wantTLS ? { servername: u.hostname } : undefined, // SNI for TLS
    };
    return { kind: 'url', url: rawUrl, options };
  }

  if (host && port) {
    const options = {
      ...baseOptions,
      host,
      port,
      username: username || undefined,
      password,
      tls: wantTLS ? { servername: host } : undefined,
    };
    return { kind: 'hostport', options };
  }

  // Fallback: if only hostname:port with no scheme was given in REDIS_URL,
  // assume TLS (managed providers commonly require it) and build URL.
  if (rawUrl) {
    const coercedUrl = `rediss://${rawUrl}`;
    const u = new URL(coercedUrl);
    const options = {
      ...baseOptions,
      username: username || undefined,
      password: password || undefined,
      tls: { servername: u.hostname },
    };
    return { kind: 'url', url: coercedUrl, options };
  }

  throw new Error('Redis configuration missing. Provide REDIS_URL or REDIS_HOST/REDIS_PORT.');
};

export const connectRedis = async (): Promise<void> => {
  if (isConnected && redisClient) {
    logger.info('Redis already connected');
    return;
  }

  try {
    const init = buildRedisInit();

    redisClient =
      init.kind === 'url'
        ? new Redis(init.url, init.options)
        : new Redis(init.options);

    redisClient.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis connected successfully');
      isConnected = true;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    redisClient.on('end', () => {
      logger.warn('Redis client disconnected');
      isConnected = false;
    });

    redisClient.on('error', (error: unknown) => {
      if (error instanceof Error) {
        logger.error('Redis client error:', { message: error.message });
      } else {
        logger.error('Redis client error:', error as any);
      }
      isConnected = false;
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
    // Continue running without Redis
  }
};

export const getRedisClient = (): RedisType | null => {
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

// Cache helpers (unchanged API)
export const setCache = async (key: string, value: any, ttl?: number): Promise<void> => {
  try {
    if (!redisClient || !isConnected) return;
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redisClient.setex(key, ttl, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
  } catch (error) {
    logger.error('Error setting cache:', error);
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    if (!redisClient || !isConnected) return null;
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Error getting cache:', error);
    return null;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    if (!redisClient || !isConnected) return;
    await redisClient.del(key);
  } catch (error) {
    logger.error('Error deleting cache:', error);
  }
};

export const clearCache = async (): Promise<void> => {
  try {
    if (!redisClient || !isConnected) return;
    await redisClient.flushdb();
    logger.info('Cache cleared');
  } catch (error) {
    logger.error('Error clearing cache:', error);
  }
};


