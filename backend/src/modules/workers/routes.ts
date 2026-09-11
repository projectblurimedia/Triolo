import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { logUploadedFiles, upload } from '@/common/middleware/upload';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { WorkersController } from './controller';
import { WorkersService } from './service';
import { WorkersRepository } from './repository';
import { createWorkerProfileSchema, updateWorkerProfileSchema } from './validation';

const repository = new WorkersRepository(pool);
// Own instance, backed by the same shared `pool` — matches how `admin/routes.ts` already
// wires up its own WorkersService/BusinessesService instances independently (no shared
// module registry in this codebase); these are stateless wrappers over the pool.
const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const service = new WorkersService(repository, notificationsService);
const controller = new WorkersController(service);

export const workersRouter = Router();

// multer parses the multipart body (text fields -> req.body, files -> req.files) before
// validateBody runs, same ordering the reference upload pipeline this was modeled on uses.
workersRouter.post(
  '/me/profile',
  authenticate,
  upload.array('portfolioPhotos', 6),
  logUploadedFiles,
  validateBody(createWorkerProfileSchema),
  controller.createProfile,
);
workersRouter.get('/me/profile', authenticate, controller.getMyProfile);
workersRouter.patch(
  '/me/profile',
  authenticate,
  upload.array('portfolioPhotos', 6),
  logUploadedFiles,
  validateBody(updateWorkerProfileSchema),
  controller.updateProfile,
);
workersRouter.delete('/me/profile', authenticate, controller.deleteProfile);
workersRouter.get('/nearby', authenticate, controller.searchNearby);
workersRouter.post('/:id/view', authenticate, controller.recordView);
