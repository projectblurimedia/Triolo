import { randomInt } from 'crypto';
import { AppError } from '@/common/errors/AppError';
import { WorkersService } from '@/modules/workers/service';
import { WorkerProfile } from '@/modules/workers/interfaces';
import { NotificationsService } from '@/modules/notifications/service';
import { NotificationType } from '@/modules/notifications/interfaces';
import { BookingsRepository } from './repository';
import { CompleteBookingDto, CreateQuickBookingDto, UpdateWorkerLocationDto } from './dto';
import {
  BookingLifecycleListener,
  BookingRequestStatus,
  BookingTransition,
  CreateAssignedBookingParams,
  CustomerBooking,
  MAX_PIN_ATTEMPTS,
  PendingOffer,
  RatedJob,
  WorkerJob,
  AdminBookingDetail,
  AdminBookingListFilter,
  NotifyTarget,
} from './interfaces';
import { bookingOfferBody, bookingOfferTitle, jobTakenBody, jobTakenTitle, TripEvent, tripTemplate } from './pushTemplates';

const BOOKING_OFFER_CHANNEL = 'booking-offers';
const HISTORY_LIMIT = 50;

/** A fresh, single-use 4-digit arrival PIN (cryptographically random). */
function generateArrivalPin(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

/**
 * Quick Book — a Rapido-style trip. A user picks skills; every verified worker within range
 * who has all of them gets a big actionable push and the first to accept wins. Then:
 *   accepted → on_the_way (worker taps Start Trip; their live location is shared)
 *   → arrived → in_progress (worker enters the customer's 4-digit PIN) → work_done
 *   → completed (customer confirms, rating the worker 1–5 with optional feedback)
 * The customer can cancel until the PIN is verified, and so can the accepted worker (from
 * accepted/on_the_way/arrived) — then a problem's trip reopens the problem for other workers. Each step notifies the other person
 * (saved in their notification list + pushed, in their own language). Depends on
 * WorkersService and NotificationsService, never their tables — same module-boundary shape as
 * `admin`/`problems`.
 */
export class BookingsService {
  private lifecycleListener: BookingLifecycleListener | null = null;

  constructor(
    private readonly repository: BookingsRepository,
    private readonly workersService: WorkersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** The problems module, told when a trip started from one of its posts ends. */
  setLifecycleListener(listener: BookingLifecycleListener): void {
    this.lifecycleListener = listener;
  }

  // --- For other modules ---

  /**
   * Starts an already-accepted trip for a Your Problems post a worker just won, so problem
   * jobs get the same map, live tracking, arrival PIN, work done and rating as Quick Book.
   * The caller (problems) notifies the customer itself. Returns the new booking's id.
   */
  async createForAcceptedProblem(params: Omit<CreateAssignedBookingParams, 'arrivalPin'>): Promise<string> {
    const request = await this.repository.createAssigned({ ...params, arrivalPin: generateArrivalPin() });
    return request.id;
  }

  /** Finished trips this worker was rated or reviewed on — for their public reviews. */
  async listRatedJobsForWorker(workerId: string, limit: number): Promise<RatedJob[]> {
    return this.repository.findRatedForWorker(workerId, limit);
  }

  /** Current status of each given booking — lets problem lists show a linked trip's progress. */
  async getStatuses(ids: string[]): Promise<Map<string, BookingRequestStatus>> {
    return this.repository.findStatuses(ids);
  }

  // --- Customer side ---

  async createQuickBooking(
    accountId: string,
    dto: CreateQuickBookingDto,
  ): Promise<{ bookingRequestId: string; matchedWorkerCount: number }> {
    const request = await this.repository.createRequest({
      accountId,
      skillCategories: dto.skillCategories,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationAddress: dto.locationAddress || null,
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
      // dataOnly: true — FCM's own `notification` payload type can't carry Accept/Reject
      // action buttons on Android, so the client composes and displays the actual
      // actionable notification itself (see partner-app's backgroundNotificationTask.ts),
      // which also runs while the app is fully closed.
      await Promise.all(
        matches.map((match) =>
          this.notificationsService.sendRawPush(
            match.accountId,
            bookingOfferTitle(match.preferredLanguage),
            bookingOfferBody(match.distanceMeters, dto.skillCategories, match.preferredLanguage),
            {
              data: { kind: 'booking_offer', bookingRequestId: request.id },
              tag: request.id,
              channelId: BOOKING_OFFER_CHANNEL,
              priority: 'max',
              dataOnly: true,
            },
          ),
        ),
      );
    }

    return { bookingRequestId: request.id, matchedWorkerCount: matches.length };
  }

  /** Polled by user-app's tracking screen: status, worker, live location and (while travelling) the PIN. */
  async getRequestStatus(accountId: string, bookingRequestId: string): Promise<CustomerBooking> {
    await this.repository.expireStaleBroadcasts();
    const request = await this.repository.findByIdForAccount(bookingRequestId, accountId);
    if (!request) {
      throw AppError.notFound('Booking request not found.', 'BOOKING_REQUEST_NOT_FOUND');
    }
    return request;
  }

  async listMyBookings(accountId: string): Promise<CustomerBooking[]> {
    await this.repository.expireStaleBroadcasts();
    return this.repository.findForCustomer(accountId, HISTORY_LIMIT);
  }

  async cancelBooking(accountId: string, bookingRequestId: string): Promise<void> {
    const result = await this.repository.cancel(bookingRequestId, accountId);
    if (!result) {
      throw await this.transitionError(bookingRequestId, 'This booking can no longer be cancelled.');
    }
    await this.notify(result, 'cancelled', 'booking_cancelled');
    // A problem's trip cancelled by the customer reopens the problem for other workers.
    if (result.request.problemPostId && this.lifecycleListener) {
      await this.lifecycleListener.onProblemTripCancelled(result.request.problemPostId);
    }
  }

  /** Customer confirms the work is finished, optionally rating the worker (once). */
  async completeBooking(accountId: string, bookingRequestId: string, dto: CompleteBookingDto = {}): Promise<void> {
    const rating = dto.rating ?? null;
    const result = await this.repository.complete(bookingRequestId, accountId, rating, dto.review || null);
    if (!result) {
      throw await this.transitionError(bookingRequestId, 'This booking cannot be marked finished right now.');
    }
    if (rating !== null && result.request.acceptedWorkerId) {
      await this.workersService.recordRating(result.request.acceptedWorkerId, rating);
    }
    await this.notify(result, 'completed', 'booking_completed');
    if (result.request.problemPostId && this.lifecycleListener) {
      await this.lifecycleListener.onProblemTripCompleted(result.request.problemPostId, rating, dto.review || null);
    }
  }

  // --- Worker side ---

  /** Feeds partner-app's Bookings tab — every offer this worker can still accept. */
  async getMyOffers(workerAccountId: string): Promise<PendingOffer[]> {
    const profile = await this.workersService.getMyProfile(workerAccountId);
    if (!profile) {
      return [];
    }
    return this.repository.findPendingOffersForWorker(profile.id);
  }

  /**
   * The worker's "Find jobs now" button: picks up every Quick Book request still looking for
   * a worker nearby (from where the worker is right now when the app sends it, else their
   * profile's service location), then returns their open offers like getMyOffers.
   */
  async searchOpenRequests(workerAccountId: string, here?: { latitude: number; longitude: number }): Promise<PendingOffer[]> {
    const worker = await this.requireWorker(workerAccountId);
    if (worker.verificationStatus !== 'verified') return [];
    const latitude = here?.latitude ?? worker.latitude;
    const longitude = here?.longitude ?? worker.longitude;
    if (latitude != null && longitude != null) {
      await this.repository.addOffersForOpenRequests(worker.id, workerAccountId, worker.skillCategories, latitude, longitude);
    }
    return this.repository.findPendingOffersForWorker(worker.id);
  }

  /** Jobs this worker accepted — active first, then history. */
  async listMyJobs(workerAccountId: string): Promise<WorkerJob[]> {
    const profile = await this.workersService.getMyProfile(workerAccountId);
    if (!profile) {
      return [];
    }
    return this.repository.findJobsForWorker(profile.id, HISTORY_LIMIT);
  }

  async getMyJob(workerAccountId: string, bookingRequestId: string): Promise<WorkerJob> {
    const worker = await this.requireWorker(workerAccountId);
    const job = await this.repository.findJobForWorker(bookingRequestId, worker.id);
    if (!job) {
      throw AppError.notFound('Job not found.', 'BOOKING_REQUEST_NOT_FOUND');
    }
    return job;
  }

  async acceptOffer(workerAccountId: string, bookingRequestId: string): Promise<void> {
    const profile = await this.requireWorker(workerAccountId);

    const result = await this.repository.acceptOffer(bookingRequestId, profile.id, generateArrivalPin());
    if (!result.won) {
      throw AppError.conflict('This job has already been taken by another worker.', 'BOOKING_ALREADY_TAKEN');
    }

    // Best-effort, in parallel: tell the customer, and replace the original notification on
    // every losing worker's device with a "taken" message (same identifier/data-only
    // mechanism as the offer push itself, so it overwrites rather than stacks). Never blocks
    // the winning worker's own accept, which has already succeeded by this point.
    await Promise.all([
      this.notify({ request: result.request, notify: result.customer }, 'accepted', 'booking_accepted'),
      ...result.losingWorkers.map((loser) =>
        this.notificationsService.sendRawPush(
          loser.accountId,
          jobTakenTitle(loser.preferredLanguage),
          jobTakenBody(loser.preferredLanguage),
          {
            data: { kind: 'booking_taken', bookingRequestId },
            tag: bookingRequestId,
            channelId: BOOKING_OFFER_CHANNEL,
            dataOnly: true,
          },
        ),
      ),
    ]);
  }

  /** The accepted worker backs out before the PIN is verified, with an optional reason. */
  async cancelByWorker(workerAccountId: string, bookingRequestId: string, reason?: string): Promise<void> {
    const worker = await this.requireWorker(workerAccountId);
    const result = await this.repository.cancelByWorker(bookingRequestId, worker.id, reason || null);
    if (!result) {
      throw await this.transitionError(bookingRequestId, 'This job can no longer be cancelled.');
    }
    const problemPostId = result.request.problemPostId;
    await this.notify(result, problemPostId ? 'worker_cancelled_problem' : 'worker_cancelled', 'booking_cancelled');
    if (problemPostId && this.lifecycleListener) {
      await this.lifecycleListener.onProblemTripCancelled(problemPostId);
    }
  }

  /** A worker dismissing an offer they don't want — only their own offer; silently no-ops if gone. */
  async declineOffer(workerAccountId: string, bookingRequestId: string): Promise<void> {
    const profile = await this.requireWorker(workerAccountId);
    await this.repository.declineOffer(bookingRequestId, profile.id);
  }

  async startTrip(workerAccountId: string, bookingRequestId: string): Promise<void> {
    const worker = await this.requireWorker(workerAccountId);
    const result = await this.repository.startTrip(bookingRequestId, worker.id);
    if (!result) {
      throw await this.transitionError(bookingRequestId, 'This trip cannot be started right now.');
    }
    await this.notify(result, 'on_the_way', 'booking_on_the_way');
  }

  /**
   * The travelling worker's latest position (called every few seconds by partner-app's
   * background location task). 409 once the trip is over, so the task knows to stop.
   */
  async updateWorkerLocation(workerAccountId: string, bookingRequestId: string, dto: UpdateWorkerLocationDto): Promise<void> {
    const worker = await this.requireWorker(workerAccountId);
    const updated = await this.repository.updateWorkerLocation(bookingRequestId, worker.id, dto.latitude, dto.longitude);
    if (!updated) {
      throw AppError.conflict('This trip is no longer active.', 'BOOKING_TRIP_NOT_ACTIVE');
    }
  }

  async markArrived(workerAccountId: string, bookingRequestId: string): Promise<void> {
    const worker = await this.requireWorker(workerAccountId);
    const result = await this.repository.markArrived(bookingRequestId, worker.id);
    if (!result) {
      throw await this.transitionError(bookingRequestId, 'Arrival cannot be marked right now.');
    }
    await this.notify(result, 'arrived', 'booking_arrived');
  }

  /** The worker enters the PIN the customer tells them in person; correct → work starts. */
  async verifyPin(workerAccountId: string, bookingRequestId: string, pin: string): Promise<void> {
    const worker = await this.requireWorker(workerAccountId);
    const result = await this.repository.verifyPin(bookingRequestId, worker.id, pin);
    if (result.outcome === 'not_found') {
      throw await this.transitionError(bookingRequestId, 'This job is not waiting for a PIN.');
    }
    if (result.outcome === 'locked') {
      throw AppError.conflict(
        `Too many wrong PINs (${MAX_PIN_ATTEMPTS}). Ask the customer to cancel and book again.`,
        'BOOKING_PIN_LOCKED',
      );
    }
    if (result.outcome === 'wrong') {
      throw AppError.badRequest('That PIN is not correct.', 'BOOKING_PIN_INVALID', { attemptsLeft: result.attemptsLeft });
    }
    // No push on PIN success — the customer is standing right there.
  }

  async markWorkDone(workerAccountId: string, bookingRequestId: string): Promise<void> {
    const worker = await this.requireWorker(workerAccountId);
    const result = await this.repository.markWorkDone(bookingRequestId, worker.id);
    if (!result) {
      throw await this.transitionError(bookingRequestId, 'This job cannot be marked done right now.');
    }
    await this.notify(result, 'work_done', 'booking_work_done');
  }

  // --- Helpers ---

  private async requireWorker(accountId: string): Promise<WorkerProfile> {
    const profile = await this.workersService.getMyProfile(accountId);
    if (!profile) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  private async transitionError(bookingRequestId: string, message: string): Promise<AppError> {
    if (!(await this.repository.exists(bookingRequestId))) {
      return AppError.notFound('Booking request not found.', 'BOOKING_REQUEST_NOT_FOUND');
    }
    return AppError.conflict(message, 'BOOKING_INVALID_STATE');
  }

  /**
   * Saved in the recipient's notification list and pushed, best-effort. `bookingId` (not
   * `bookingRequestId`) in the data on purpose: partner-app's push handlers treat a
   * `bookingRequestId` as a new job offer to pop up.
   */
  private async notify(transition: BookingTransition, event: TripEvent, type: NotificationType): Promise<void> {
    if (!transition.notify) return;
    const text = tripTemplate(event, transition.notify.preferredLanguage);
    await this.notificationsService.notify(transition.notify.accountId, type, text.title, text.body, {
      data: { kind: type, bookingId: transition.request.id },
      channelId: 'default',
    });
  }

  // --- Admin ---

  async adminList(filter: AdminBookingListFilter) {
    await this.repository.expireStaleBroadcasts();
    return this.repository.adminList(filter);
  }

  async adminGet(id: string): Promise<AdminBookingDetail> {
    await this.repository.expireStaleBroadcasts();
    const booking = await this.repository.adminGet(id);
    if (!booking) throw AppError.notFound('Booking not found.', 'BOOKING_REQUEST_NOT_FOUND');
    return booking;
  }

  /**
   * The admin stops an unfinished booking at any step. Both people are told, with the reason.
   * A problem's trip reopens the problem, the same as any other cancellation.
   */
  async adminCancel(id: string, reason: string | null): Promise<void> {
    const result = await this.repository.adminCancel(id, reason);
    if (!result) throw await this.transitionError(id, 'This booking is already finished.');
    const tell = (target: NotifyTarget) => {
      const text = tripTemplate('admin_cancelled', target.preferredLanguage);
      const why = reason ? (target.preferredLanguage === 'te' ? ` కారణం: ${reason}` : ` Reason: ${reason}`) : '';
      return this.notificationsService.notify(target.accountId, 'booking_cancelled', text.title, `${text.body}${why}`, {
        data: { kind: 'booking_cancelled', bookingId: id },
        channelId: 'default',
      });
    };
    await Promise.all([tell(result.customer), ...(result.worker ? [tell(result.worker)] : [])]);
    if (result.request.problemPostId && this.lifecycleListener) {
      await this.lifecycleListener.onProblemTripCancelled(result.request.problemPostId);
    }
  }

  /** Cancels every unfinished booking an account is part of (when it's suspended or banned). */
  async adminCancelActiveForAccount(accountId: string, reason: string | null): Promise<number> {
    const ids = await this.repository.adminActiveIdsForAccount(accountId);
    for (const id of ids) {
      await this.adminCancel(id, reason).catch(() => undefined);
    }
    return ids.length;
  }

  adminCounts() {
    return this.repository.adminCounts();
  }
}
