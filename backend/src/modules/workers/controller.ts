import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { created, ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { WorkersService } from './service';

export class WorkersController {
  constructor(private readonly service: WorkersService) {}

  createProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const profile = await this.service.createProfile(req.account.accountId, req.body, files);
    return created(res, profile, 'Worker profile created');
  });

  getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const profile = await this.service.getMyProfile(req.account.accountId);
    return ok(res, profile);
  });
}
