import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { created, ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { BookingsService } from './service';

export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  createQuickBooking = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const result = await this.service.createQuickBooking(req.account.accountId, req.body);
    return created(res, result, 'Quick Book request broadcast');
  });

  getStatus = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const result = await this.service.getRequestStatus(req.account.accountId, req.params.id);
    return ok(res, result);
  });

  getMyOffers = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const result = await this.service.getMyOffers(req.account.accountId);
    return ok(res, result);
  });

  acceptOffer = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    await this.service.acceptOffer(req.account.accountId, req.params.id);
    return ok(res, null, 'Job accepted');
  });
}
