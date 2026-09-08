import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { NotFoundError } from './utils/errors';

// Route Imports
import authRoutes from './routes/auth.routes';
import campaignRoutes from './routes/campaign.routes';
import emailRoutes from './routes/email.routes';
import uploadRoutes from './routes/upload.routes';
import slackRoutes from './routes/slack.routes';
import { queueBoardRouter } from './config/queue-board';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        const configured = env.FRONTEND_URL.replace(/\/$/, '');
        if (
          requestOrigin === configured ||
          requestOrigin === `${configured}/` ||
          requestOrigin === 'http://localhost:3000' ||
          requestOrigin.endsWith('.vercel.app')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // BullMQ Live UI Dashboard
  app.use('/admin/queues', queueBoardRouter);

  // API Route Mounts
  app.use('/api/auth', authRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/slack', slackRoutes);

  // 404 handler for unmatched routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
