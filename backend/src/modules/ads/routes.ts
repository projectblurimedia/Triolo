import { Request, Response, Router } from 'express';
import { ZodTypeAny, z } from 'zod';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { created, ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { AdsRepository } from './repository';
import { AdsService } from './service';
import { SaveAdParams } from './interfaces';
import {
  adListQuerySchema,
  adMediaSchema,
  adSettingsSchema,
  saveAdSchema,
  serveQuerySchema,
  uploadSignatureSchema,
} from './validation';

const service = new AdsService(new AdsRepository(pool));

/** The image / video sent along with an ad's details, if any. */
function mediaOf(body: { imageUrl?: string | null; videoUrl?: string | null }) {
  return { imageUrl: body.imageUrl ?? null, videoUrl: body.videoUrl ?? null };
}

function parseQuery<S extends ZodTypeAny>(schema: S, req: Request): z.infer<S> {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw AppError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', result.error.flatten());
  }
  return result.data;
}

// Thin enough not to need its own controller file (same as favorites / job seekers).

/** The apps: the banner to show now, and a tap on it. */
export const adsRouter = Router();

adsRouter.get(
  '/serve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const query = parseQuery(serveQuerySchema, req);
    return ok(
      res,
      await service.serve(
        query.app,
        query.placement,
        { latitude: query.latitude, longitude: query.longitude },
        query.exclude ?? null,
      ),
    );
  }),
);

adsRouter.post(
  '/:id/click',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await service.recordClick(req.params.id);
    return ok(res, null);
  }),
);

/**
 * The admin's ad desk, mounted by the admin router at /admin/ads (which already requires an
 * admin session), so it owns its routes without the admin module reaching into ad tables.
 */
export const adsAdminRouter = Router();

adsAdminRouter.get(
  '/overview',
  asyncHandler(async (_req: Request, res: Response) => ok(res, await service.overview())),
);

adsAdminRouter.patch(
  '/settings',
  validateBody(adSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.updateSettings(req.body), 'Ad settings saved')),
);

adsAdminRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = parseQuery(adListQuerySchema, req);
    const result = await service.list(query);
    return ok(res, { ...result, page: query.page, limit: query.limit });
  }),
);

adsAdminRouter.post(
  '/',
  validateBody(saveAdSchema),
  asyncHandler(async (req: Request, res: Response) =>
    created(res, await service.create(req.body as SaveAdParams, mediaOf(req.body)), 'Ad booked'),
  ),
);

adsAdminRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.get(req.params.id))),
);

adsAdminRouter.put(
  '/:id',
  validateBody(saveAdSchema),
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.update(req.params.id, req.body as SaveAdParams, mediaOf(req.body)), 'Ad updated'),
  ),
);

adsAdminRouter.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => ok(res, await service.remove(req.params.id), 'Ad deleted')),
);

// Media goes straight from the admin's browser to Cloudinary (videos are far over Vercel's
// 4.5 MB body limit): first a signed permission, then the final list of URLs for the ad.
adsAdminRouter.post(
  '/upload-signature',
  validateBody(uploadSignatureSchema),
  asyncHandler(async (req: Request, res: Response) => ok(res, service.uploadSignature(req.body.kind))),
);

adsAdminRouter.put(
  '/:id/media',
  validateBody(adMediaSchema),
  asyncHandler(async (req: Request, res: Response) =>
    ok(res, await service.setMedia(req.params.id, req.body.imageUrl ?? null, req.body.videoUrl ?? null), 'Media saved'),
  ),
);

/**
 * Vercel Cron (vercel.json) calls this daily so finished ads' media is deleted even when
 * nobody opens the apps or the admin desk. Vercel sends `Authorization: Bearer CRON_SECRET`.
 */
adsRouter.get(
  '/cron/cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) throw AppError.unauthorized();
    return ok(res, { cleaned: await service.cleanupFinishedMedia(), unusedUploads: await service.cleanupUnusedUploads() });
  }),
);
