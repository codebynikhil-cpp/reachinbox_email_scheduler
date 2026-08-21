import { app } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';
import { campaignService } from './services/campaign.service';
import { logger } from './utils/logger';

const PORT = env.PORT;

async function startServer() {
  try {
    // Attempt DB connection & reconcile scheduled jobs
    await connectDatabase()
      .then(async () => {
        const reconciled = await campaignService.reconcileScheduledJobs();
        if (reconciled > 0) {
          logger.info(`Reconciled ${reconciled} scheduled email jobs with BullMQ on startup.`);
        }
      })
      .catch((err) => {
        logger.warn('Initial database connection failed. Will retry on queries.', {
          error: err.message,
        });
      });

    const server = app.listen(PORT, () => {
      logger.info(`ReachInbox Email Scheduler Backend running on port ${PORT}`, {
        environment: env.NODE_ENV,
        port: PORT,
      });
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        await disconnectDatabase();
        await disconnectRedis();
        logger.info('Graceful shutdown completed. Exiting process.');
        process.exit(0);
      });

      // Force exit after 10 seconds timeout
      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing termination.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Fatal error during server startup', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
// Job ID colon fix applied

