import { Request, Response, Router } from 'express';
import { SubscriptionsRepository } from '@/modules/subscriptions/repository';
import { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { logUploadedFiles, upload } from '@/common/middleware/upload';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { JobSeekersRepository } from './repository';
import { JobSeekersService } from './service';
import { saveJobSeekerPostSchema, searchQuerySchema, setActiveSchema } from './validation';

const subscriptionStatus = new SubscriptionStatusService(new SubscriptionsRepository(pool));
const service = new JobSeekersService(
  new JobSeekersRepository(pool),
  subscriptionStatus,
  new NotificationsService(new NotificationsRepository(pool)),
);

function accountIdOf(req: Request): string {
  if (!req.account) throw AppError.unauthorized();
  return req.account.accountId;
}

// Thin enough not to need its own controller file (same as favorites).
export const jobSeekersRouter = Router();

// Customer side: nearby people looking for work, with their phone to call.
jobSeekersRouter.get(
  '/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.badRequest('Invalid search', 'VALIDATION_ERROR', parsed.error.flatten());
    }
    return ok(res, await service.search(accountIdOf(req), parsed.data));
  }),
);

// Kinds of work people typed themselves, for the Hire Staff picker's search.
jobSeekersRouter.get(
  '/custom-titles',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const query = String(req.query.query ?? '').trim().slice(0, 40);
    return ok(res, query.length < 1 ? [] : await service.searchCustomTitles(query));
  }),
);

// One live post — e.g. an ad's "Contact".
jobSeekersRouter.get(
  '/public/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.getPublic(req.params.id, accountIdOf(req)))),
);

// A customer opened a post: one more visit for the poster to see.
jobSeekersRouter.post(
  '/:id/view',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await service.recordView(req.params.id, accountIdOf(req));
    return ok(res, null);
  }),
);

// Who opened one of my posts (people hidden without the job post plan), and marking them seen.
jobSeekersRouter.get(
  '/me/posts/:id/viewers',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.listViewers(accountIdOf(req), req.params.id))),
);

jobSeekersRouter.post(
  '/me/posts/:id/viewers/seen',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await service.markViewsSeen(accountIdOf(req), req.params.id);
    return ok(res, null);
  }),
);

// Poster side: their posts (several), each by id.
jobSeekersRouter.get(
  '/me/posts',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.listMine(accountIdOf(req)))),
);

jobSeekersRouter.post(
  '/me/posts',
  authenticate,
  validateBody(saveJobSeekerPostSchema),
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.createMine(accountIdOf(req), req.body), 'Job post saved')),
);

jobSeekersRouter.put(
  '/me/posts/:id',
  authenticate,
  validateBody(saveJobSeekerPostSchema),
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.updateMine(accountIdOf(req), req.params.id, req.body), 'Job post saved'),
  ),
);

jobSeekersRouter.patch(
  '/me/posts/:id/active',
  authenticate,
  validateBody(setActiveSchema),
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.setActive(accountIdOf(req), req.body.isActive, req.params.id), 'Job post updated'),
  ),
);

jobSeekersRouter.put(
  '/me/posts/:id/photo',
  authenticate,
  upload.single('photo'),
  logUploadedFiles,
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.setPhoto(accountIdOf(req), req.file, req.params.id), 'Photo saved'),
  ),
);

jobSeekersRouter.delete(
  '/me/posts/:id/photo',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.removePhoto(accountIdOf(req), req.params.id), 'Photo removed')),
);

jobSeekersRouter.delete(
  '/me/posts/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteMine(accountIdOf(req), req.params.id);
    return ok(res, null, 'Job post deleted');
  }),
);

// Older app builds: their single post (the first one).
jobSeekersRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.getMine(accountIdOf(req)))),
);

jobSeekersRouter.put(
  '/me',
  authenticate,
  validateBody(saveJobSeekerPostSchema),
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.saveMine(accountIdOf(req), req.body), 'Job post saved'),
  ),
);

jobSeekersRouter.patch(
  '/me/active',
  authenticate,
  validateBody(setActiveSchema),
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.setActive(accountIdOf(req), req.body.isActive), 'Job post updated'),
  ),
);

// Profile photo — its own request, like problem photos (keeps each body small for Vercel).
jobSeekersRouter.put(
  '/me/photo',
  authenticate,
  upload.single('photo'),
  logUploadedFiles,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.setPhoto(accountIdOf(req), req.file), 'Photo saved')),
);

jobSeekersRouter.delete(
  '/me/photo',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.removePhoto(accountIdOf(req)), 'Photo removed')),
);

jobSeekersRouter.delete(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteMine(accountIdOf(req));
    return ok(res, null, 'Job post deleted');
  }),
);
