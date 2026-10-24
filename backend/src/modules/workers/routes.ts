import { Request, Response, Router } from 'express';
import { SubscriptionsRepository } from '@/modules/subscriptions/repository';
import { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
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
const subscriptionStatus = new SubscriptionStatusService(new SubscriptionsRepository(pool));
const service = new WorkersService(repository, notificationsService, subscriptionStatus);
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
// Profile photo — its own request, like job-post photos (keeps each body small for Vercel).
workersRouter.put('/me/profile/photo', authenticate, upload.single('photo'), logUploadedFiles, controller.setProfilePhoto);
workersRouter.delete('/me/profile/photo', authenticate, controller.removeProfilePhoto);
workersRouter.get('/nearby', authenticate, controller.searchNearby);

// Skills workers added themselves, for the apps' searchable skill pickers.
workersRouter.get(
  '/custom-skills',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const query = String(req.query.query ?? '').trim().slice(0, 40);
    return ok(res, query.length < 1 ? [] : await service.searchCustomSkills(query));
  }),
);
// One verified worker as customers see them (no contact details) — e.g. an ad's "Book Now".
workersRouter.get(
  '/public/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const [profile] = await service.getVerifiedProfiles([req.params.id]);
    if (!profile) throw AppError.notFound('This worker is not available.', 'WORKER_NOT_FOUND');
    return ok(res, profile);
  }),
);
workersRouter.post('/:id/view', authenticate, controller.recordView);
