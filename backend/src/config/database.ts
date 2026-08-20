import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL Database via Prisma');
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL Database', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Disconnected from PostgreSQL Database');
  } catch (error) {
    logger.error('Error disconnecting from PostgreSQL Database', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
