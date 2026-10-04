'use strict';

const Redis = require('ioredis');
const logger = require('./logger');

let redisClient = null;

const getRedisClient = () => {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times) => {
      if (times > 5) {
        logger.error('Redis: max retries exceeded');
        return null;
      }
      return Math.min(times * 200, 3000);
    },
    reconnectOnError: (err) => {
      logger.error('Redis reconnect error:', err.message);
      return true;
    },
    lazyConnect: false,
  });

  redisClient.on('connect', () => logger.info('Redis: connected'));
  redisClient.on('ready', () => logger.info('Redis: ready'));
  redisClient.on('error', (err) => logger.error('Redis error:', err.message));
  redisClient.on('close', () => logger.warn('Redis: connection closed'));

  return redisClient;
};

/**
 * Set a key with optional TTL (in seconds)
 */
const setCache = async (key, value, ttlSeconds = 3600) => {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.error('Redis setCache error:', error.message);
    return false;
  }
};

/**
 * Get a cached value
 */
const getCache = async (key) => {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis getCache error:', error.message);
    return null;
  }
};

/**
 * Delete a cached key
 */
const deleteCache = async (key) => {
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    logger.error('Redis deleteCache error:', error.message);
    return false;
  }
};

/**
 * Add a token to the blacklist (for logout/revocation)
 */
const blacklistToken = async (token, expiresInSeconds = 3600) => {
  return setCache(`blacklist:${token}`, true, expiresInSeconds);
};

/**
 * Check if a token is blacklisted
 */
const isTokenBlacklisted = async (token) => {
  const result = await getCache(`blacklist:${token}`);
  return result === true;
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

module.exports = {
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  blacklistToken,
  isTokenBlacklisted,
  disconnectRedis,
};
