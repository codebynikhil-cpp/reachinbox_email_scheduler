import { Router } from 'express';
import { campaignController } from '../controllers/campaign.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { createCampaignSchema } from '../validators/campaign.validator';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest(createCampaignSchema),
  campaignController.create.bind(campaignController)
);

export default router;
