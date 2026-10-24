import fs from 'fs';
import type { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
import { AppError } from '@/common/errors/AppError';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
import { WorkersService } from '@/modules/workers/service';
import { WorkerProfile } from '@/modules/workers/interfaces';
import { NotificationsService } from '@/modules/notifications/service';
import { BookingsService } from '@/modules/bookings/service';
import { BookingLifecycleListener } from '@/modules/bookings/interfaces';
import { ProblemsRepository } from './repository';
import { CompleteProblemDto, CreateProblemPostDto, UpdateProblemPostDto } from './dto';
import {
  AssignedProblem,
  NearbyProblem,
  OwnProblemPost,
  ProblemPost,
  ProblemTransitionResult,
  RatedJob,
  WithTripStatus,
  AdminProblemListFilter,
  AdminProblemPost,
} from './interfaces';
import { problemPushTemplates } from './pushTemplates';

const PROBLEM_PHOTOS_FOLDER = 'triolo/problems';
const DEFAULT_LIST_LIMIT = 50;
// Wide on purpose for testing, same as Quick Book's broadcast radius.
const NEARBY_RADIUS_KM = 50;

type PushKind = 'problem_accepted' | 'problem_work_done' | 'problem_completed';

/**
 * Your Problems — a customer posts a non-emergency problem (location, worker type(s),
 * quotation, up to 5 photos); verified workers nearby with a matching skill see it on
 * partner-app's Home and the first to accept gets the job. Then:
 *   open → accepted (worker accepts) → work_done (worker) → completed (customer confirms)
 * The customer confirms the finish because they're the one who can verify the work and is
 * paying for it; they can also confirm straight from 'accepted'. Each step pushes the other
 * side. Depends on WorkersService/NotificationsService (never their tables directly) — the
 * same module-boundary shape as bookings.
 */
export class ProblemsService implements BookingLifecycleListener {
  constructor(
    private readonly repository: ProblemsRepository,
    private readonly workersService: WorkersService,
    private readonly notificationsService: NotificationsService,
    private readonly bookingsService: BookingsService,
    // Subscribed workers see new problems first (the head start).
    private readonly subscriptionStatus?: SubscriptionStatusService,
  ) {}

  // --- Customer side ---

  async createPost(accountId: string, dto: CreateProblemPostDto): Promise<ProblemPost> {
    return this.repository.create({
      accountId,
      skillCategories: dto.skillCategories,
      description: dto.description || null,
      quotationAmount: dto.quotationAmount,
      locationAddress: dto.locationAddress,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });
  }

  async updatePost(accountId: string, postId: string, dto: UpdateProblemPostDto): Promise<ProblemPost> {
    const existing = await this.getOwnOpenPost(accountId, postId);

    // Only URLs the post actually has can be kept — never trust a client-supplied URL list.
    const keptPhotoUrls = existing.photoUrls.filter((url) => dto.keepPhotoUrls.includes(url));
    const removedPhotoUrls = existing.photoUrls.filter((url) => !keptPhotoUrls.includes(url));

    const updated = await this.repository.update(postId, accountId, {
      skillCategories: dto.skillCategories,
      description: dto.description || null,
      quotationAmount: dto.quotationAmount,
      locationAddress: dto.locationAddress,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      photoUrls: keptPhotoUrls,
    });
    if (!updated) {
      // A worker accepted between the read above and this write.
      throw AppError.conflict('A worker has already accepted this problem.', 'PROBLEM_NOT_EDITABLE');
    }
    await deletePhotosFromCloudinary(removedPhotoUrls);
    return updated;
  }

  async addPhoto(accountId: string, postId: string, file: Express.Multer.File | undefined): Promise<ProblemPost> {
    if (!file) {
      throw AppError.badRequest('A photo is required.', 'PHOTO_REQUIRED');
    }

    try {
      await this.getOwnOpenPost(accountId, postId);
    } catch (err) {
      // uploadToCloudinary normally deletes the temp file — it won't run here, so clean up ourselves.
      fs.promises.unlink(file.path).catch(() => {});
      throw err;
    }

    const uploaded = await uploadToCloudinary(file.path, PROBLEM_PHOTOS_FOLDER);
    const updated = await this.repository.appendPhoto(postId, accountId, uploaded.url);
    if (!updated) {
      await deletePhotosFromCloudinary([uploaded.url]);
      throw AppError.conflict('This post already has the maximum number of photos.', 'PROBLEM_PHOTO_LIMIT');
    }
    return updated;
  }

  /** Allowed while open or once completed — never mid-job, while a worker is on it. */
  async deletePost(accountId: string, postId: string): Promise<void> {
    const existing = await this.repository.findByIdForAccount(postId, accountId);
    if (!existing) {
      return;
    }
    if (existing.status === 'accepted' || existing.status === 'work_done') {
      throw AppError.conflict('This job is in progress and cannot be deleted.', 'PROBLEM_IN_PROGRESS');
    }
    await this.repository.delete(postId, accountId);
    await deletePhotosFromCloudinary(existing.photoUrls);
  }

  async listMyPosts(accountId: string): Promise<OwnProblemPost[]> {
    return this.withTripStatuses(await this.repository.findForAccount(accountId, DEFAULT_LIST_LIMIT));
  }

  async completeProblem(accountId: string, postId: string, dto: CompleteProblemDto = {}): Promise<ProblemPost> {
    const rating = dto.rating ?? null;
    const result = await this.repository.complete(postId, accountId, rating, dto.review || null);
    if (!result) {
      throw await this.transitionError(postId, 'This problem cannot be marked finished right now.');
    }
    if (rating !== null && result.post.acceptedWorkerId) {
      await this.workersService.recordRating(result.post.acceptedWorkerId, rating);
    }
    await this.push(result, problemPushTemplates.completed(result.notifyLanguage), 'problem_completed');
    return result.post;
  }

  // --- Worker side ---

  async listNearbyForWorker(accountId: string): Promise<NearbyProblem[]> {
    const worker = await this.getVerifiedWorker(accountId);
    if (worker.latitude == null || worker.longitude == null) {
      return [];
    }
    const headStart = await this.subscriptionStatus?.headStart();
    const minAgeSeconds = headStart && !headStart.subscriberIds.has(accountId) ? headStart.seconds : 0;
    return this.repository.findNearbyOpen(
      accountId,
      worker.skillCategories,
      worker.latitude,
      worker.longitude,
      NEARBY_RADIUS_KM,
      DEFAULT_LIST_LIMIT,
      minAgeSeconds,
    );
  }

  async listAssignedToWorker(accountId: string): Promise<AssignedProblem[]> {
    const worker = await this.workersService.getMyProfile(accountId);
    if (!worker) {
      return [];
    }
    return this.withTripStatuses(await this.repository.findAssignedToWorker(worker.id, DEFAULT_LIST_LIMIT));
  }

  /**
   * First accept wins, then the job runs as a trip: an already-accepted booking is started
   * for it (map, live tracking, arrival PIN, work done, rating — the same flow as Quick
   * Book). If starting the trip fails, the post is reopened so it isn't stuck half-accepted.
   */
  async acceptProblem(accountId: string, postId: string): Promise<ProblemPost> {
    const worker = await this.getVerifiedWorker(accountId);
    const passId = (await this.subscriptionStatus?.usePartnerPass(accountId, 'accept')) ?? null;
    const result = await this.repository.accept(postId, worker.id, accountId);
    if (!result) {
      await this.subscriptionStatus?.restorePasses([], [passId]);
      if (!(await this.repository.exists(postId))) {
        throw AppError.notFound('Problem not found.', 'PROBLEM_POST_NOT_FOUND');
      }
      throw AppError.conflict('Another worker has already accepted this problem.', 'PROBLEM_ALREADY_TAKEN');
    }

    const post = result.post;
    let bookingRequestId: string;
    try {
      bookingRequestId = await this.bookingsService.createForAcceptedProblem({
        customerAccountId: post.accountId,
        workerId: worker.id,
        skillCategories: post.skillCategories,
        // Nearby only lists posts with GPS coordinates, so an accepted post always has them.
        latitude: post.latitude as number,
        longitude: post.longitude as number,
        locationAddress: post.locationAddress,
        distanceMeters: distanceBetween(worker.latitude, worker.longitude, post.latitude, post.longitude),
        problemPostId: post.id,
        quotationAmount: post.quotationAmount,
      });
      await this.repository.setBookingRequest(post.id, bookingRequestId);
    } catch (err) {
      await this.repository.reopen(post.id);
      await this.subscriptionStatus?.restorePasses([], [passId]);
      throw err;
    }
    await this.subscriptionStatus?.attachPass(passId, `accept-${post.id}`);

    await this.push(result, problemPushTemplates.accepted(result.notifyLanguage), 'problem_accepted', bookingRequestId);
    return { ...post, bookingRequestId };
  }

  // --- Trip lifecycle (BookingLifecycleListener, called by the bookings module) ---

  async onProblemTripCompleted(problemPostId: string, rating: number | null, review: string | null): Promise<void> {
    await this.repository.completeFromTrip(problemPostId, rating, review);
  }

  async onProblemTripCancelled(problemPostId: string): Promise<void> {
    await this.repository.reopen(problemPostId);
  }

  /** Rated jobs accepted before trips existed — trip-linked ones are listed by bookings. */
  async listRatedJobsForWorker(workerId: string, limit: number): Promise<RatedJob[]> {
    return this.repository.findRatedForWorker(workerId, limit);
  }

  async markWorkDone(accountId: string, postId: string): Promise<ProblemPost> {
    const worker = await this.workersService.getMyProfile(accountId);
    if (!worker) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    const result = await this.repository.markWorkDone(postId, worker.id);
    if (!result) {
      throw await this.transitionError(postId, 'This job cannot be marked done right now.');
    }
    await this.push(result, problemPushTemplates.workDone(result.notifyLanguage), 'problem_work_done');
    return result.post;
  }

  // --- Helpers ---

  private async getOwnOpenPost(accountId: string, postId: string): Promise<ProblemPost> {
    const existing = await this.repository.findByIdForAccount(postId, accountId);
    if (!existing) {
      throw AppError.notFound('Problem post not found.', 'PROBLEM_POST_NOT_FOUND');
    }
    if (existing.status !== 'open') {
      throw AppError.conflict('A worker has already accepted this problem.', 'PROBLEM_NOT_EDITABLE');
    }
    return existing;
  }

  private async getVerifiedWorker(accountId: string): Promise<WorkerProfile> {
    const worker = await this.workersService.getMyProfile(accountId);
    if (!worker) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    if (worker.verificationStatus !== 'verified') {
      throw AppError.forbidden('Your worker profile is not verified yet.', 'WORKER_NOT_VERIFIED');
    }
    return worker;
  }

  private async transitionError(postId: string, message: string): Promise<AppError> {
    if (!(await this.repository.exists(postId))) {
      return AppError.notFound('Problem not found.', 'PROBLEM_POST_NOT_FOUND');
    }
    return AppError.conflict(message, 'PROBLEM_INVALID_STATE');
  }

  /**
   * Saved as an in-app notification (so it shows in the recipient's notification list in
   * either app) plus a best-effort push. The push never fails the transition itself.
   */
  private async push(result: ProblemTransitionResult, text: { title: string; body: string }, kind: PushKind, bookingId?: string) {
    // `bookingId` lets a tap open the trip tracker straight away.
    const data: Record<string, string> = { kind, problemId: result.post.id };
    if (bookingId) data.bookingId = bookingId;
    await this.notificationsService.notify(result.notifyAccountId, kind, text.title, text.body, {
      data,
      channelId: 'default',
    });
  }

  /** Fills in each post's linked trip status (one query for the whole list). */
  private async withTripStatuses<T extends ProblemPost & WithTripStatus>(posts: T[]): Promise<T[]> {
    const ids = posts.map((post) => post.bookingRequestId).filter((id): id is string => id !== null);
    if (ids.length === 0) return posts;
    const statuses = await this.bookingsService.getStatuses(ids);
    return posts.map((post) => ({
      ...post,
      bookingStatus: post.bookingRequestId ? (statuses.get(post.bookingRequestId) ?? null) : null,
    }));
  }

  // --- Admin ---

  adminList(filter: AdminProblemListFilter) {
    return this.repository.adminList(filter);
  }

  async adminGet(id: string): Promise<AdminProblemPost> {
    const post = await this.repository.adminGet(id);
    if (!post) throw AppError.notFound('Problem post not found.', 'PROBLEM_NOT_FOUND');
    return post;
  }

  /**
   * Takes an open post down. A post a worker already took is stopped by cancelling its trip
   * (bookings) instead, which reopens it — then it can be closed here.
   */
  async adminClose(id: string, reason: string | null): Promise<ProblemPost> {
    const closed = await this.repository.adminClose(id, reason);
    if (!closed) {
      await this.adminGet(id);
      throw AppError.conflict('Only an open problem can be closed. Cancel its booking first.', 'PROBLEM_NOT_OPEN');
    }
    return closed;
  }

  adminCloseOpenForAccount(accountId: string, reason: string | null) {
    return this.repository.adminCloseOpenForAccount(accountId, reason);
  }

  adminCounts() {
    return this.repository.adminCounts();
  }
}

/** Haversine distance in meters, or null when either point is unknown. */
function distanceBetween(lat1: number | null, lng1: number | null, lat2: number | null, lng2: number | null): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}
