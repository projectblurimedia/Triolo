import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { NotificationsService } from './service';

export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const result = await this.service.listForAccount(req.account.accountId);
    return ok(res, result);
  });

  markRead = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    await this.service.markRead(req.account.accountId, req.params.id);
    return ok(res, null, 'Notification marked as read');
  });

  markAllRead = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    await this.service.markAllRead(req.account.accountId);
    return ok(res, null, 'All notifications marked as read');
  });
}
