import { AppError } from '@/common/errors/AppError';
import { WorkersService } from '@/modules/workers/service';
import { NotificationsService } from '@/modules/notifications/service';
import { BookingsRepository } from './repository';
import { CreateQuickBookingDto } from './dto';
import { BookingRequestWithAcceptedWorker, PendingOffer } from './interfaces';
import { bookingOfferBody, bookingOfferTitle, jobTakenBody, jobTakenTitle } from './pushTemplates';

const BOOKING_OFFER_CHANNEL = 'booking-offers';

/**
 * Quick Book — first real (non-placeholder) slice of broadcast booking, per explicit
 * request: a user picks one or more skills, every verified worker within radius who has
 * *all* of them gets a big, high-priority push; whoever accepts first wins and everyone
 * else's offer/notification is closed out. No PIN verification, cancellation, or full
 * status pipeline yet (Pending Module 4's remainder). Depends on `WorkersService` (never
 * touches `worker_profiles` directly) and `NotificationsService` (never touches
 * `push_tokens` directly) — same module-boundary shape `admin`/`notifications` already
 * established, see `.cloud/architecture.md`'s Backend Module Boundaries.
 */
export class BookingsService {
  constructor(
    private readonly repository: BookingsRepository,
    private readonly workersService: WorkersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createQuickBooking(
    accountId: string,
    dto: CreateQuickBookingDto,
  ): Promise<{ bookingRequestId: string; matchedWorkerCount: number }> {
    const request = await this.repository.createRequest({
      accountId,
      skillCategories: dto.skillCategories,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusKm: dto.radiusKm,
    });

    const matches = await this.workersService.findMatchingForBroadcast(
      accountId,
      dto.skillCategories,
      dto.latitude,
      dto.longitude,
      dto.radiusKm,
    );

    if (matches.length > 0) {
      await this.repository.createOffers(
        request.id,
        matches.map((match) => ({ workerId: match.workerId, distanceMeters: match.distanceMeters })),
      );

      // Fire every push in parallel — a slow/failed send to one worker must never delay or
      // block delivery to the others (each is independently best-effort, see pushSender.ts).
      await Promise.all(
        matches.map((match) =>
          this.notificationsService.sendRawPush(
            match.accountId,
            bookingOfferTitle(match.preferredLanguage),
            bookingOfferBody(match.distanceMeters, dto.skillCategories, match.preferredLanguage),
            {
              data: { type: 'booking_offer', bookingRequestId: request.id },
              tag: request.id,
              channelId: BOOKING_OFFER_CHANNEL,
              priority: 'max',
            },
          ),
        ),
      );
    }

    return { bookingRequestId: request.id, matchedWorkerCount: matches.length };
  }

  /** Polled by the requester (user-app) while waiting for a worker to accept. */
  async getRequestStatus(accountId: string, bookingRequestId: string): Promise<BookingRequestWithAcceptedWorker> {
    const request = await this.repository.findByIdForAccount(bookingRequestId, accountId);
    if (!request) {
      throw AppError.notFound('Booking request not found.', 'BOOKING_REQUEST_NOT_FOUND');
    }
    return request;
  }

  /** Feeds partner-app's Bookings tab — every offer this worker can still accept. */
  async getMyOffers(workerAccountId: string): Promise<PendingOffer[]> {
    const profile = await this.workersService.getMyProfile(workerAccountId);
    if (!profile) {
      return [];
    }
    return this.repository.findPendingOffersForWorker(profile.id);
  }

  async acceptOffer(workerAccountId: string, bookingRequestId: string): Promise<void> {
    const profile = await this.workersService.getMyProfile(workerAccountId);
    if (!profile) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }

    const result = await this.repository.acceptOffer(bookingRequestId, profile.id);
    if (!result.won) {
      throw AppError.conflict('This job has already been taken by another worker.', 'BOOKING_ALREADY_TAKEN');
    }

    // Best-effort — replaces the same-tagged notification on every losing worker's device
    // with a "taken" message via native Android tag-replacement (see pushSender.ts), so the
    // big broadcast notification doesn't sit there stale once the job is gone. Never blocks
    // the winning worker's own accept, which has already succeeded by this point.
    await Promise.all(
      result.losingWorkers.map((loser) =>
        this.notificationsService.sendRawPush(
          loser.accountId,
          jobTakenTitle(loser.preferredLanguage),
          jobTakenBody(loser.preferredLanguage),
          { tag: bookingRequestId, channelId: BOOKING_OFFER_CHANNEL },
        ),
      ),
    );
  }
}
