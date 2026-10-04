'use strict';

require('dotenv').config();

const app = require('./app');
const { connectDB, sequelize } = require('./db/database');
const { getRedisClient } = require('./utils/redis');
const logger = require('./utils/logger');
const { User, Role, UserRole, Grant, Application } = require('./models');

const PORT = parseInt(process.env.PORT || '3000', 10);

/**
 * Initialize database and sync models
 */
const initDatabase = async () => {
  await connectDB();

  // Sync models without forcing (preserve existing data)
  await sequelize.sync({ alter: false });
  logger.info('Database models synchronized.');
};

/**
 * Initialize Redis connection
 */
const initRedis = () => {
  try {
    const client = getRedisClient();
    logger.info('Redis client initialized.');
    return client;
  } catch (error) {
    logger.warn('Redis initialization failed (non-fatal):', error.message);
    return null;
  }
};

/**
 * Graceful shutdown handler
 */
const shutdown = async (server) => {
  logger.info('Shutting down gracefully...');
  server.close(async () => {
    try {
      await sequelize.close();
      logger.info('Database connection closed.');
      const { disconnectRedis } = require('./utils/redis');
      await disconnectRedis();
      logger.info('Redis connection closed.');
    } catch (err) {
      logger.error('Error during shutdown:', err);
    }
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

/**
 * Start the server
 */
const start = async () => {
  try {
    // Initialize database
    await initDatabase();

    // Initialize Redis
    initRedis();

    // Start HTTP server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown(server));
    process.on('SIGINT', () => shutdown(server));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      shutdown(server);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
start();

module.exports = { start };
