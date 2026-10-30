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
import { BusinessesController } from './controller';
import { BusinessesService } from './service';
import { BusinessesRepository } from './repository';
import { addStaffSchema, createBusinessProfileSchema, updateBusinessProfileSchema } from './validation';
import { AuthRepository } from '@/modules/auth/repository';
import { AuthService } from '@/modules/auth/service';

const repository = new BusinessesRepository(pool);
const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const subscriptionStatus = new SubscriptionStatusService(new SubscriptionsRepository(pool));
const service = new BusinessesService(repository, notificationsService, subscriptionStatus, new AuthService(new AuthRepository(pool)));
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

function accountIdOf(req: Request): string {
  if (!req.account) throw AppError.unauthorized();
  return req.account.accountId;
}

// All my shops (a partner may own several).
businessesRouter.get(
  '/me/shops',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.listMyShops(accountIdOf(req)))),
);

// A shop's delivery staff: the owner adds people by phone; they sign in with their own OTP.
businessesRouter.get(
  '/me/shops/:shopId/staff',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.listStaff(accountIdOf(req), req.params.shopId))),
);
businessesRouter.post(
  '/me/shops/:shopId/staff',
  authenticate,
  validateBody(addStaffSchema),
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.addStaff(accountIdOf(req), req.params.shopId, req.body), 'Staff added'),
  ),
);
businessesRouter.delete(
  '/me/shops/:shopId/staff/:staffId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.removeStaff(accountIdOf(req), req.params.shopId, req.params.staffId), 'Staff removed'),
  ),
);

// The shops I deliver for (as someone's staff).
businessesRouter.get(
  '/staff/invites',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.listMyInvites(accountIdOf(req)))),
);
businessesRouter.post(
  '/staff/invites/:businessId/accept',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.answerInvite(accountIdOf(req), req.params.businessId, true), 'Joined')),
);
businessesRouter.post(
  '/staff/invites/:businessId/decline',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.answerInvite(accountIdOf(req), req.params.businessId, false), 'Declined')),
);
businessesRouter.get(
  '/staff/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.staffShops(accountIdOf(req)))),
);

// Categories shops added themselves, for the apps' searchable category pickers.
businessesRouter.get(
  '/custom-categories',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const query = String(req.query.query ?? '').trim().slice(0, 40);
    return ok(res, query.length < 1 ? [] : await service.searchCustomCategories(query));
  }),
);
// One verified shop as customers see it — e.g. an ad's "Order from this Shop".
businessesRouter.get(
  '/public/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const [profile] = await service.getVerifiedProfiles([req.params.id]);
    if (!profile) throw AppError.notFound('This shop is not available.', 'SHOP_NOT_FOUND');
    return ok(res, profile);
  }),
);
businessesRouter.post('/:id/view', authenticate, controller.recordView);
