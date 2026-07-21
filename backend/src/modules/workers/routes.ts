import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { upload } from '@/common/middleware/upload';
import { WorkersController } from './controller';
import { WorkersService } from './service';
import { WorkersRepository } from './repository';
import { createWorkerProfileSchema, updateWorkerProfileSchema } from './validation';

const repository = new WorkersRepository(pool);
const service = new WorkersService(repository);
const controller = new WorkersController(service);

export const workersRouter = Router();

// multer parses the multipart body (text fields -> req.body, files -> req.files) before
// validateBody runs, same ordering the reference upload pipeline this was modeled on uses.
workersRouter.post(
  '/me/profile',
  authenticate,
  upload.array('portfolioPhotos', 6),
  validateBody(createWorkerProfileSchema),
  controller.createProfile,
);
workersRouter.get('/me/profile', authenticate, controller.getMyProfile);
workersRouter.patch(
  '/me/profile',
  authenticate,
  upload.array('portfolioPhotos', 6),
  validateBody(updateWorkerProfileSchema),
  controller.updateProfile,
);
workersRouter.delete('/me/profile', authenticate, controller.deleteProfile);
