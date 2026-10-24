import { Request, Response, Router } from 'express';
import { ZodTypeAny, z } from 'zod';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { WorkersRepository } from '@/modules/workers/repository';
import { WorkersService } from '@/modules/workers/service';
import { BusinessesRepository } from '@/modules/businesses/repository';
import { BusinessesService } from '@/modules/businesses/service';
import { JobSeekersRepository } from '@/modules/jobSeekers/repository';
import { JobSeekersService } from '@/modules/jobSeekers/service';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { SubscriptionsRepository } from './repository';
import { SubscriptionStatusService } from './statusService';
import { SubscriptionsService } from './service';
import {
  audienceQuerySchema,
  badgeCheckoutSchema,
  badgeListQuerySchema,
  checkoutSchema,
  passCheckoutSchema,
  passListQuerySchema,
  removeBadgeSchema,
  subscriptionListQuerySchema,
  subscriptionSettingsSchema,
} from './validation';

const repository = new SubscriptionsRepository(pool);
const notifications = new NotificationsService(new NotificationsRepository(pool));
const service = new SubscriptionsService(repository, new SubscriptionStatusService(repository), {
  workers: new WorkersService(new WorkersRepository(pool), notifications),
  businesses: new BusinessesService(new BusinessesRepository(pool), notifications),
  jobSeekers: new JobSeekersService(new JobSeekersRepository(pool)),
  notifications,
});

function accountIdOf(req: Request): string {
  if (!req.account) throw AppError.unauthorized();
  return req.account.accountId;
}

function parseQuery<S extends ZodTypeAny>(schema: S, req: Request): z.infer<S> {
  const result = schema.safeParse(req.query);
  if (!result.success) throw AppError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', result.error.flatten());
  return result.data;
}

/** The apps: subscription plans and "Trusted by Triolo" badges. */
export const subscriptionsRouter = Router();

subscriptionsRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.getMine(accountIdOf(req), parseQuery(audienceQuerySchema, req).audience)),
  ),
);

subscriptionsRouter.post(
  '/checkout',
  authenticate,
  validateBody(checkoutSchema),
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.checkout(accountIdOf(req), req.body.audience, req.body.months))),
);

subscriptionsRouter.get(
  '/badges/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.getMyBadges(accountIdOf(req)))),
);

subscriptionsRouter.get(
  '/badges/trusted',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => ok(res, await service.trustedIds())),
);

subscriptionsRouter.post(
  '/badges/checkout',
  authenticate,
  validateBody(badgeCheckoutSchema),
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.badgeCheckout(accountIdOf(req), req.body.kind))),
);

subscriptionsRouter.post(
  '/badges/:id/check',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.badgeCheckPayment(accountIdOf(req), req.params.id))),
);

// Pay per use (no plan): one booking / order / phone number, one accept / job post.
subscriptionsRouter.post(
  '/passes/checkout',
  authenticate,
  validateBody(passCheckoutSchema),
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.passCheckout(accountIdOf(req), req.body.kind, req.body.targetId ?? null)),
  ),
);

subscriptionsRouter.post(
  '/passes/:id/check',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.passCheckPayment(accountIdOf(req), req.params.id))),
);

subscriptionsRouter.post(
  '/:id/check',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.checkPayment(accountIdOf(req), req.params.id))),
);

/** Mounted by the admin router at /admin/subscriptions (admin-only there). */
export const subscriptionsAdminRouter = Router();

subscriptionsAdminRouter.get(
  '/overview',
  asyncHandler(async (_req: Request, res: Response) => ok(res, await service.overview())),
);

subscriptionsAdminRouter.patch(
  '/settings',
  validateBody(subscriptionSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.updateSettings(req.body), 'Saved')),
);

subscriptionsAdminRouter.get(
  '/list',
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.listSubscriptions(parseQuery(subscriptionListQuerySchema, req)))),
);

subscriptionsAdminRouter.get(
  '/badges',
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.listBadges(parseQuery(badgeListQuerySchema, req)))),
);

subscriptionsAdminRouter.get(
  '/passes',
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.listPasses(parseQuery(passListQuerySchema, req)))),
);

subscriptionsAdminRouter.get(
  '/badges/review',
  asyncHandler(async (_req: Request, res: Response) => ok(res, await service.badgesToReview())),
);

subscriptionsAdminRouter.post(
  '/badges/:id/remove',
  validateBody(removeBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.removeBadge(req.params.id, req.body.reason), 'Badge removed')),
);
