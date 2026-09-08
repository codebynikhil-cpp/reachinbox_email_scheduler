import { Request, Response, NextFunction } from 'express';
import { slackService } from '../services/slack.service';
import { AuthenticatedRequest } from '../types';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class SlackController {
  public async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const status = await slackService.getStatus(userId);
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  public async getAuthUrl(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const url = slackService.getOAuthAuthorizeUrl(userId);
      res.status(200).json({ success: true, data: { url } });
    } catch (error) {
      next(error);
    }
  }

  public async handleCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query;

    if (error || !code || !state) {
      logger.warn('Slack OAuth callback error or rejected by user', { error });
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
      return;
    }

    try {
      await slackService.handleOAuthCallback(String(code), String(state));
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
    } catch (err) {
      logger.error('Slack OAuth callback handling failed', { err });
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=failed`);
    }
  }

  public async setWebhook(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { webhookUrl } = req.body;

      if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        res.status(400).json({
          success: false,
          message: 'Please provide a valid Slack webhook URL starting with https://hooks.slack.com/',
        });
        return;
      }

      await slackService.setWebhook(userId, webhookUrl);
      res.status(200).json({
        success: true,
        message: 'Slack webhook connected and verified successfully!',
      });
    } catch (error) {
      next(error);
    }
  }

  public async disconnect(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      await slackService.disconnect(userId);
      res.status(200).json({
        success: true,
        message: 'Slack disconnected successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const slackController = new SlackController();
