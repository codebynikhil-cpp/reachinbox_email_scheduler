import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  ...(env.REDIS_URL.startsWith('rediss://')
    ? { tls: { rejectUnauthorized: false } }
    : {}),
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry attempt #${times}, waiting ${delay}ms`);
    return delay;
  },
};

export const redis = new Redis(env.REDIS_URL, redisOptions);

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('ready', () => {
  logger.info('Redis client ready to handle commands');
});

redis.on('error', (err: Error) => {
  logger.error('Redis connection error', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export async function disconnectRedis(): Promise<void> {
  try {
    if (redis.status !== 'end') {
      await redis.quit();
      logger.info('Disconnected from Redis');
    }
  } catch (error) {
    logger.error('Error disconnecting from Redis', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
