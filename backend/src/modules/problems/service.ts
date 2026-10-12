import fs from 'fs';
import { AppError } from '@/common/errors/AppError';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
import { WorkersService } from '@/modules/workers/service';
import { WorkerProfile } from '@/modules/workers/interfaces';
import { NotificationsService } from '@/modules/notifications/service';
import { ProblemsRepository } from './repository';
import { CompleteProblemDto, CreateProblemPostDto, UpdateProblemPostDto } from './dto';
import { AssignedProblem, NearbyProblem, OwnProblemPost, ProblemPost, ProblemTransitionResult } from './interfaces';
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
export class ProblemsService {
  constructor(
    private readonly repository: ProblemsRepository,
    private readonly workersService: WorkersService,
    private readonly notificationsService: NotificationsService,
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
    return this.repository.findForAccount(accountId, DEFAULT_LIST_LIMIT);
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
    return this.repository.findNearbyOpen(
      accountId,
      worker.skillCategories,
      worker.latitude,
      worker.longitude,
      NEARBY_RADIUS_KM,
      DEFAULT_LIST_LIMIT,
    );
  }

  async listAssignedToWorker(accountId: string): Promise<AssignedProblem[]> {
    const worker = await this.workersService.getMyProfile(accountId);
    if (!worker) {
      return [];
    }
    return this.repository.findAssignedToWorker(worker.id, DEFAULT_LIST_LIMIT);
  }

  async acceptProblem(accountId: string, postId: string): Promise<ProblemPost> {
    const worker = await this.getVerifiedWorker(accountId);
    const result = await this.repository.accept(postId, worker.id, accountId);
    if (!result) {
      if (!(await this.repository.exists(postId))) {
        throw AppError.notFound('Problem not found.', 'PROBLEM_POST_NOT_FOUND');
      }
      throw AppError.conflict('Another worker has already accepted this problem.', 'PROBLEM_ALREADY_TAKEN');
    }
    await this.push(result, problemPushTemplates.accepted(result.notifyLanguage), 'problem_accepted');
    return result.post;
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
  private async push(result: ProblemTransitionResult, text: { title: string; body: string }, kind: PushKind) {
    await this.notificationsService.notify(result.notifyAccountId, kind, text.title, text.body, {
      data: { kind, problemId: result.post.id },
      channelId: 'default',
    });
  }
}
