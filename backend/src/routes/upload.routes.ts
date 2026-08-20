import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth.middleware';
import { BadRequestError } from '../utils/errors';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    const isCsvOrText =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv') ||
      file.originalname.toLowerCase().endsWith('.txt');

    if (!isCsvOrText) {
      return cb(new BadRequestError('Only CSV or text files are supported'));
    }
    cb(null, true);
  },
});

router.post(
  '/leads',
  authenticate,
  upload.single('file'),
  uploadController.uploadLeads.bind(uploadController)
);

router.post(
  '/csv',
  authenticate,
  upload.single('file'),
  uploadController.uploadLeads.bind(uploadController)
);

export default router;
