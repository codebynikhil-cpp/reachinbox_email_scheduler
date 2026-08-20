import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/google', authController.googleAuth.bind(authController));
router.get('/google/url', authController.getGoogleAuthUrl.bind(authController));
router.get('/google/callback', authController.googleCallback.bind(authController));
router.get('/me', authenticate, authController.getMe.bind(authController));
router.post('/logout', authController.logout.bind(authController));

export default router;
