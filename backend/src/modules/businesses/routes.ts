import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { logUploadedFiles, upload } from '@/common/middleware/upload';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { BusinessesController } from './controller';
import { BusinessesService } from './service';
import { BusinessesRepository } from './repository';
import { createBusinessProfileSchema, updateBusinessProfileSchema } from './validation';

const repository = new BusinessesRepository(pool);
const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const service = new BusinessesService(repository, notificationsService);
const controller = new BusinessesController(service);

export const businessesRouter = Router();

businessesRouter.post(
  '/me/profile',
  authenticate,
  upload.array('shopPhotos', 6),
  logUploadedFiles,
  validateBody(createBusinessProfileSchema),
  controller.createProfile,
);
businessesRouter.get('/me/profile', authenticate, controller.getMyProfile);
businessesRouter.patch(
  '/me/profile',
  authenticate,
  upload.array('shopPhotos', 6),
  logUploadedFiles,
  validateBody(updateBusinessProfileSchema),
  controller.updateProfile,
);
businessesRouter.delete('/me/profile', authenticate, controller.deleteProfile);
// Profile photo — its own request, like job-post photos (keeps each body small for Vercel).
businessesRouter.put('/me/profile/photo', authenticate, upload.single('photo'), logUploadedFiles, controller.setProfilePhoto);
businessesRouter.delete('/me/profile/photo', authenticate, controller.removeProfilePhoto);
businessesRouter.get('/nearby', authenticate, controller.searchNearby);
businessesRouter.post('/:id/view', authenticate, controller.recordView);
