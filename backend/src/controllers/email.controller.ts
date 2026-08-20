import { Response, NextFunction } from 'express';
import { emailService } from '../services/email.service';
import { AuthenticatedRequest } from '../types';
import { UnauthorizedError } from '../utils/errors';

export class EmailController {
  public async getScheduled(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const campaignId = req.query.campaignId as string | undefined;

      const result = await emailService.getScheduledEmails(
        user.id,
        page,
        limit,
        campaignId
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async getSent(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const campaignId = req.query.campaignId as string | undefined;

      const result = await emailService.getSentEmails(
        user.id,
        page,
        limit,
        campaignId
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async getStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const stats = await emailService.getEmailStats(user.id);
      res.status(200).json({ success: true, stats });
    } catch (error) {
      next(error);
    }
  }
}

export const emailController = new EmailController();
