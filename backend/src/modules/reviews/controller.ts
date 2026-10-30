import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { ReviewsService } from './service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  getForWorker = asyncHandler(async (req: Request, res: Response) => {
    // A malformed id would otherwise surface as a Postgres cast error (500).
    if (!UUID_PATTERN.test(req.params.workerId)) {
      throw AppError.notFound('Worker not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    return ok(res, await this.service.getForWorker(req.params.workerId));
  });

  getForMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    return ok(res, await this.service.getForMe(req.account.accountId));
  });

  getForBusiness = asyncHandler(async (req: Request, res: Response) => {
    if (!UUID_PATTERN.test(req.params.businessId)) {
      throw AppError.notFound('Shop not found.', 'SHOP_NOT_FOUND');
    }
    return ok(res, await this.service.getForBusiness(req.params.businessId));
  });

  getForMyShop = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    return ok(res, await this.service.getForMyShop(req.account.accountId, typeof req.query.shopId === 'string' ? req.query.shopId : undefined));
  });
}
