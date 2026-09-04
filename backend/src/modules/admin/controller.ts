import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { AdminService } from './service';
import { listQuerySchema } from './validation';

export class AdminController {
  constructor(private readonly service: AdminService) {}

  // No shared query-validation middleware exists yet (only validateBody) — parsing here
  // inline is simpler than adding one for this single use, and still rejects a bad
  // ?status=/?page=/?limit= the same way validateBody rejects a bad body.
  private parseListQuery(req: Request) {
    const result = listQuerySchema.safeParse(req.query);
    if (!result.success) {
      throw AppError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', result.error.flatten());
    }
    return result.data;
  }

  listWorkers = asyncHandler(async (req: Request, res: Response) => {
    const query = this.parseListQuery(req);
    const result = await this.service.listWorkers(query);
    return ok(res, result);
  });

  getWorker = asyncHandler(async (req: Request, res: Response) => {
    const profile = await this.service.getWorker(req.params.id);
    return ok(res, profile);
  });

  setWorkerVerification = asyncHandler(async (req: Request, res: Response) => {
    const profile = await this.service.setWorkerVerification(req.params.id, req.body.status);
    return ok(res, profile, 'Verification status updated');
  });

  listBusinesses = asyncHandler(async (req: Request, res: Response) => {
    const query = this.parseListQuery(req);
    const result = await this.service.listBusinesses(query);
    return ok(res, result);
  });

  getBusiness = asyncHandler(async (req: Request, res: Response) => {
    const profile = await this.service.getBusiness(req.params.id);
    return ok(res, profile);
  });

  setBusinessVerification = asyncHandler(async (req: Request, res: Response) => {
    const profile = await this.service.setBusinessVerification(req.params.id, req.body.status);
    return ok(res, profile, 'Verification status updated');
  });
}
