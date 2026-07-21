import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { created, ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { BusinessesService } from './service';

export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}

  createProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const profile = await this.service.createProfile(req.account.accountId, req.body, files);
    return created(res, profile, 'Business profile created');
  });

  getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const profile = await this.service.getMyProfile(req.account.accountId);
    return ok(res, profile);
  });

  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const profile = await this.service.updateProfile(req.account.accountId, req.body, files);
    return ok(res, profile, 'Business profile updated');
  });

  deleteProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    await this.service.deleteProfile(req.account.accountId);
    return ok(res, null, 'Business profile deleted');
  });
}
