import { Request, Response } from 'express';
import { ZodTypeAny, z } from 'zod';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { AdminService } from './service';
import {
  accountListQuerySchema,
  bookingListQuerySchema,
  jobPostListQuerySchema,
  listQuerySchema,
  orderListQuerySchema,
  problemListQuerySchema,
} from './validation';

// No shared query-validation middleware exists (only validateBody) — each list parses its
// own query inline and rejects a bad one the same way validateBody rejects a bad body.
function parseQuery<S extends ZodTypeAny>(schema: S, req: Request): z.infer<S> {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw AppError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', result.error.flatten());
  }
  return result.data;
}

export class AdminController {
  constructor(private readonly service: AdminService) {}

  stats = asyncHandler(async (_req: Request, res: Response) => ok(res, await this.service.getStats()));

  // Accounts
  listAccounts = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.listAccounts(parseQuery(accountListQuerySchema, req))),
  );
  getAccount = asyncHandler(async (req: Request, res: Response) => ok(res, await this.service.getAccount(req.params.id)));
  moderateAccount = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.moderateAccount(req.params.id, req.body), 'Account updated'),
  );
  removeProfiles = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.removeProfiles(req.params.id, req.body?.reason), 'Profiles removed and account banned'),
  );

  // Workers / shops
  listWorkers = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.listWorkers(parseQuery(listQuerySchema, req))),
  );
  getWorker = asyncHandler(async (req: Request, res: Response) => ok(res, await this.service.getWorker(req.params.id)));
  setWorkerVerification = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.setWorkerVerification(req.params.id, req.body.status), 'Verification status updated'),
  );
  listBusinesses = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.listBusinesses(parseQuery(listQuerySchema, req))),
  );
  getBusiness = asyncHandler(async (req: Request, res: Response) => ok(res, await this.service.getBusiness(req.params.id)));
  setBusinessVerification = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.setBusinessVerification(req.params.id, req.body.status), 'Verification status updated'),
  );

  // Bookings
  listBookings = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.listBookings(parseQuery(bookingListQuerySchema, req))),
  );
  getBooking = asyncHandler(async (req: Request, res: Response) => ok(res, await this.service.getBooking(req.params.id)));
  cancelBooking = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.cancelBooking(req.params.id, req.body?.reason), 'Booking cancelled'),
  );

  // Orders
  listOrders = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.listOrders(parseQuery(orderListQuerySchema, req))),
  );
  getOrder = asyncHandler(async (req: Request, res: Response) => ok(res, await this.service.getOrder(req.params.id)));
  cancelOrder = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.cancelOrder(req.params.id, req.body?.reason), 'Order cancelled'),
  );

  // Problems
  listProblems = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.listProblems(parseQuery(problemListQuerySchema, req))),
  );
  getProblem = asyncHandler(async (req: Request, res: Response) => ok(res, await this.service.getProblem(req.params.id)));
  closeProblem = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.closeProblem(req.params.id, req.body?.reason), 'Problem closed'),
  );

  // Job posts
  listJobPosts = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.listJobPosts(parseQuery(jobPostListQuerySchema, req))),
  );
  getJobPost = asyncHandler(async (req: Request, res: Response) => ok(res, await this.service.getJobPost(req.params.id)));
  setJobPostActive = asyncHandler(async (req: Request, res: Response) =>
    ok(res, await this.service.setJobPostActive(req.params.id, req.body.isActive, req.body.reason), 'Job post updated'),
  );
  removeJobPost = asyncHandler(async (req: Request, res: Response) => {
    await this.service.removeJobPost(req.params.id, req.body?.reason);
    return ok(res, null, 'Job post removed');
  });
}
