import { Request, Response, Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { AuthRepository } from '@/modules/auth/repository';
import { AuthService } from '@/modules/auth/service';
import { WorkersRepository } from '@/modules/workers/repository';
import { WorkersService } from '@/modules/workers/service';
import { BusinessesRepository } from '@/modules/businesses/repository';
import { BusinessesService } from '@/modules/businesses/service';
import { JobSeekersRepository } from '@/modules/jobSeekers/repository';
import { JobSeekersService } from '@/modules/jobSeekers/service';
import { BookingsRepository } from '@/modules/bookings/repository';
import { BookingsService } from '@/modules/bookings/service';
import { OrdersRepository } from '@/modules/orders/repository';
import { OrdersService } from '@/modules/orders/service';
import { ProblemsRepository } from '@/modules/problems/repository';
import { ProblemsService } from '@/modules/problems/service';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { AccountDeletionService } from './service';

// Own instances, the same way admin/routes.ts wires itself up.
const notifications = new NotificationsService(new NotificationsRepository(pool));
const workers = new WorkersService(new WorkersRepository(pool), notifications);
const businesses = new BusinessesService(new BusinessesRepository(pool), notifications);
const bookings = new BookingsService(new BookingsRepository(pool), workers, notifications);
const problems = new ProblemsService(new ProblemsRepository(pool), workers, notifications, bookings);
bookings.setLifecycleListener(problems);
const service = new AccountDeletionService({
  auth: new AuthService(new AuthRepository(pool)),
  workers,
  businesses,
  jobSeekers: new JobSeekersService(new JobSeekersRepository(pool)),
  bookings,
  orders: new OrdersService(new OrdersRepository(pool), businesses, notifications),
  problems,
  notifications,
});

function requireAccountId(req: Request): string {
  if (!req.account) throw AppError.unauthorized();
  return req.account.accountId;
}

export const accountDeletionRouter = Router();

/** Deletes the caller's own account (see AccountDeletionService). */
accountDeletionRouter.delete(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteMyAccount(requireAccountId(req));
    return ok(res, null, 'Account deleted');
  }),
);

/** Vercel Cron (vercel.json), daily: wipes accounts deleted 30+ days ago and old orders' media. */
accountDeletionRouter.get(
  '/cron/daily',
  asyncHandler(async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) throw AppError.unauthorized();
    return ok(res, await service.dailyCleanup());
  }),
);
