import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { upload } from '@/common/middleware/upload';
import { BusinessesController } from './controller';
import { BusinessesService } from './service';
import { BusinessesRepository } from './repository';
import { createBusinessProfileSchema } from './validation';

const repository = new BusinessesRepository(pool);
const service = new BusinessesService(repository);
const controller = new BusinessesController(service);

export const businessesRouter = Router();

businessesRouter.post(
  '/me/profile',
  authenticate,
  upload.array('shopPhotos', 6),
  validateBody(createBusinessProfileSchema),
  controller.createProfile,
);
businessesRouter.get('/me/profile', authenticate, controller.getMyProfile);
