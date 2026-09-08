import { Router } from 'express';
import { slackController } from '../controllers/slack.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Slack OAuth redirect callback (called by Slack directly)
router.get('/callback', slackController.handleCallback.bind(slackController));

// Protected user routes
router.get('/status', authenticate, slackController.getStatus.bind(slackController));
router.get('/auth-url', authenticate, slackController.getAuthUrl.bind(slackController));
router.post('/webhook', authenticate, slackController.setWebhook.bind(slackController));
router.delete('/disconnect', authenticate, slackController.disconnect.bind(slackController));

export default router;
