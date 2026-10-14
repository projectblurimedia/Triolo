import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { WorkersRepository } from '@/modules/workers/repository';
import { WorkersService } from '@/modules/workers/service';
import { BusinessesRepository } from '@/modules/businesses/repository';
import { BusinessesService } from '@/modules/businesses/service';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { FavoritesRepository } from './repository';
import { FavoritesService } from './service';
import { FAVORITE_TARGET_TYPES, FavoriteTargetType } from './interfaces';

const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const service = new FavoritesService(
  new FavoritesRepository(pool),
  new WorkersService(new WorkersRepository(pool), notificationsService),
  new BusinessesService(new BusinessesRepository(pool), notificationsService),
);

// Small enough not to need its own controller file: three handlers, all thin.
const targetSchema = z.object({
  type: z.enum(FAVORITE_TARGET_TYPES as [FavoriteTargetType, ...FavoriteTargetType[]]),
  id: z.string().uuid(),
});

function parseTarget(req: Request) {
  const parsed = targetSchema.safeParse(req.params);
  if (!parsed.success) {
    throw AppError.badRequest('Invalid favorite', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  if (!req.account) throw AppError.unauthorized();
  return { accountId: req.account.accountId, ...parsed.data };
}

export const favoritesRouter = Router();

favoritesRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) throw AppError.unauthorized();
    return ok(res, await service.list(req.account.accountId));
  }),
);

favoritesRouter.put(
  '/:type/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { accountId, type, id } = parseTarget(req);
    await service.add(accountId, type, id);
    return ok(res, null, 'Saved to favorites');
  }),
);

favoritesRouter.delete(
  '/:type/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { accountId, type, id } = parseTarget(req);
    await service.remove(accountId, type, id);
    return ok(res, null, 'Removed from favorites');
  }),
);
