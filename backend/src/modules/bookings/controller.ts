import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { created, ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { BookingsService } from './service';

function requireAccountId(req: Request): string {
  if (!req.account) {
    throw AppError.unauthorized();
  }
  return req.account.accountId;
}

export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  // --- Customer side ---

  createQuickBooking = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.createQuickBooking(requireAccountId(req), req.body);
    return created(res, result, 'Quick Book request broadcast');
  });

  getStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getRequestStatus(requireAccountId(req), req.params.id);
    return ok(res, result);
  });

  listMine = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.listMyBookings(requireAccountId(req));
    return ok(res, result);
  });

  cancel = asyncHandler(async (req: Request, res: Response) => {
    await this.service.cancelBooking(requireAccountId(req), req.params.id);
    return ok(res, null, 'Booking cancelled');
  });

  complete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.completeBooking(requireAccountId(req), req.params.id, req.body);
    return ok(res, null, 'Booking completed');
  });

  // --- Worker side ---

  getMyOffers = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getMyOffers(requireAccountId(req));
    return ok(res, result);
  });

  listMyJobs = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.listMyJobs(requireAccountId(req));
    return ok(res, result);
  });

  getMyJob = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getMyJob(requireAccountId(req), req.params.id);
    return ok(res, result);
  });

  acceptOffer = asyncHandler(async (req: Request, res: Response) => {
    await this.service.acceptOffer(requireAccountId(req), req.params.id);
    return ok(res, null, 'Job accepted');
  });

  declineOffer = asyncHandler(async (req: Request, res: Response) => {
    await this.service.declineOffer(requireAccountId(req), req.params.id);
    return ok(res, null, 'Job declined');
  });

  startTrip = asyncHandler(async (req: Request, res: Response) => {
    await this.service.startTrip(requireAccountId(req), req.params.id);
    return ok(res, null, 'Trip started');
  });

  updateLocation = asyncHandler(async (req: Request, res: Response) => {
    await this.service.updateWorkerLocation(requireAccountId(req), req.params.id, req.body);
    return ok(res, null, 'Location updated');
  });

  markArrived = asyncHandler(async (req: Request, res: Response) => {
    await this.service.markArrived(requireAccountId(req), req.params.id);
    return ok(res, null, 'Marked as arrived');
  });

  verifyPin = asyncHandler(async (req: Request, res: Response) => {
    await this.service.verifyPin(requireAccountId(req), req.params.id, req.body.pin);
    return ok(res, null, 'PIN verified');
  });

  markWorkDone = asyncHandler(async (req: Request, res: Response) => {
    await this.service.markWorkDone(requireAccountId(req), req.params.id);
    return ok(res, null, 'Work marked done');
  });
}
