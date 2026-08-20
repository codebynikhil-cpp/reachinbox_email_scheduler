import { Response, NextFunction } from 'express';
import { campaignService } from '../services/campaign.service';
import { AuthenticatedRequest } from '../types';
import { UnauthorizedError } from '../utils/errors';

export class CampaignController {
  public async create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required to create a campaign');
      }

      const result = await campaignService.createCampaign(user.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const campaignController = new CampaignController();
