import { Router } from 'express';
import { emailController } from '../controllers/email.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { paginationQuerySchema } from '../validators/campaign.validator';

const router = Router();

router.get(
  '/scheduled',
  authenticate,
  validateRequest(paginationQuerySchema),
  emailController.getScheduled.bind(emailController)
);

router.get(
  '/sent',
  authenticate,
  validateRequest(paginationQuerySchema),
  emailController.getSent.bind(emailController)
);

router.get(
  '/stats',
  authenticate,
  emailController.getStats.bind(emailController)
);

router.get(
  '/search',
  authenticate,
  emailController.search.bind(emailController)
);

// Public verifiable preview of delivered email
router.get('/:id/preview', emailController.preview.bind(emailController));

export default router;
