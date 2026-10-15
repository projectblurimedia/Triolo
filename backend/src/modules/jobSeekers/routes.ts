import { Request, Response, Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { logUploadedFiles, upload } from '@/common/middleware/upload';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { JobSeekersRepository } from './repository';
import { JobSeekersService } from './service';
import { saveJobSeekerPostSchema, searchQuerySchema, setActiveSchema } from './validation';

const service = new JobSeekersService(new JobSeekersRepository(pool));

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

// Poster side: their own post.
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
