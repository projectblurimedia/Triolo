import fs from 'fs';
import type { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
import { AppError } from '@/common/errors/AppError';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
import { JobSeekersRepository } from './repository';
import {
  JobSeekerPost,
  JobSeekerSearchParams,
  JobSeekerSearchResult,
  SaveJobSeekerPostParams,
  AdminJobSeekerListFilter,
  AdminJobSeekerPost,
} from './interfaces';

const PHOTO_FOLDER = 'triolo/job-seekers';

/**
 * "Looking for work" posts (Job Seekers). Owns `job_seeker_posts` and depends on no other
 * module. A partner keeps one post; customers find nearby posts and call the poster directly.
 */
export class JobSeekersService {
  constructor(
    private readonly repository: JobSeekersRepository,
    // Subscribed partners' posts come first in searches (optional: tests and admin don't need it).
    private readonly subscriptionStatus?: SubscriptionStatusService,
  ) {}

  /** One live post (e.g. an ad's "Contact"). The phone number shows only with a plan or once paid for. */
  async getPublic(id: string, viewerAccountId?: string): Promise<JobSeekerSearchResult> {
    const post = await this.repository.findPublicById(id);
    if (!post) throw AppError.notFound('This job post is not available.', 'JOB_POST_NOT_FOUND');
    if (!viewerAccountId) return post;
    const [shown] = await this.withContactAccess(viewerAccountId, [post]);
    return shown;
  }

  /** Hides phone numbers the viewer hasn't paid to see (while customer plans are on and they have none). */
  private async withContactAccess(viewerAccountId: string, posts: JobSeekerSearchResult[]): Promise<JobSeekerSearchResult[]> {
    const access = await this.subscriptionStatus?.staffContactAccess(viewerAccountId);
    if (!access || access.all) return posts.map((post) => ({ ...post, contactLocked: false }));
    return posts.map((post) =>
      access.ids.has(post.id) || post.accountId === viewerAccountId
        ? { ...post, contactLocked: false }
        : { ...post, mobileNumber: null, contactLocked: true },
    );
  }

  getMine(accountId: string): Promise<JobSeekerPost | null> {
    return this.repository.findByAccount(accountId);
  }

  async saveMine(accountId: string, params: SaveJobSeekerPostParams): Promise<JobSeekerPost> {
    const skills = [...new Set(params.skills.map((skill) => skill.trim()).filter(Boolean))];
    const description = params.description?.trim() ? params.description.trim() : null;
    // A new post (not an edit) takes a paid pass when the partner has no plan.
    const isNew = !(await this.repository.findByAccount(accountId));
    const passId = isNew ? ((await this.subscriptionStatus?.usePartnerPass(accountId, 'job_post')) ?? null) : null;
    try {
      const post = await this.repository.upsert(accountId, { ...params, skills, description });
      await this.subscriptionStatus?.attachPass(passId, post.id);
      return post;
    } catch (error) {
      await this.subscriptionStatus?.restorePasses([], [passId]);
      throw error;
    }
  }

  async setActive(accountId: string, isActive: boolean): Promise<JobSeekerPost> {
    const post = await this.repository.setActive(accountId, isActive);
    if (!post) throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    return post;
  }

  async deleteMine(accountId: string): Promise<void> {
    const deleted = await this.repository.delete(accountId);
    if (!deleted) throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    if (deleted.photoUrl) await deletePhotosFromCloudinary([deleted.photoUrl]);
  }

  /** Uploads a new profile photo for the caller's post (replacing any previous one). */
  async setPhoto(accountId: string, file: Express.Multer.File | undefined): Promise<JobSeekerPost> {
    if (!file) throw AppError.badRequest('A photo is required.', 'PHOTO_REQUIRED');
    if (!(await this.repository.findByAccount(accountId))) {
      // uploadToCloudinary would normally remove the temp file; it won't run here.
      fs.promises.unlink(file.path).catch(() => {});
      throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    }
    const uploaded = await uploadToCloudinary(file.path, PHOTO_FOLDER);
    const result = await this.repository.setPhoto(accountId, uploaded.url);
    if (!result) {
      await deletePhotosFromCloudinary([uploaded.url]);
      throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    }
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.post;
  }

  async removePhoto(accountId: string): Promise<JobSeekerPost> {
    const result = await this.repository.setPhoto(accountId, null);
    if (!result) throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.post;
  }

  async search(accountId: string, params: JobSeekerSearchParams): Promise<JobSeekerSearchResult[]> {
    const priorityAccountIds = (await this.subscriptionStatus?.priorityPartnerIds()) ?? [];
    return this.withContactAccess(accountId, await this.repository.search(accountId, { ...params, priorityAccountIds }));
  }

  // --- Admin ---

  adminList(filter: AdminJobSeekerListFilter) {
    return this.repository.adminList(filter);
  }

  async adminGet(id: string): Promise<AdminJobSeekerPost> {
    const post = await this.repository.adminGet(id);
    if (!post) throw AppError.notFound('Job post not found.', 'JOB_POST_NOT_FOUND');
    return post;
  }

  /** Hide (or show again) a post; returns it so the caller can tell the poster. */
  async adminSetActive(id: string, isActive: boolean): Promise<AdminJobSeekerPost> {
    if (!(await this.repository.adminSetActive(id, isActive))) {
      throw AppError.notFound('Job post not found.', 'JOB_POST_NOT_FOUND');
    }
    return this.adminGet(id);
  }

  /** Removes a post and its photo; returns the poster's account id. */
  async adminDelete(id: string): Promise<string> {
    const removed = await this.repository.adminDelete(id);
    if (!removed) throw AppError.notFound('Job post not found.', 'JOB_POST_NOT_FOUND');
    if (removed.photoUrl) await deletePhotosFromCloudinary([removed.photoUrl]);
    return removed.accountId;
  }

  /** Removes an account's post, if it has one (used when the admin deletes an account's profiles). */
  async adminDeleteForAccount(accountId: string): Promise<boolean> {
    const removed = await this.repository.delete(accountId);
    if (removed?.photoUrl) await deletePhotosFromCloudinary([removed.photoUrl]);
    return removed !== null;
  }

  adminCounts() {
    return this.repository.adminCounts();
  }

  /** Kinds of work people typed themselves ("other") on live posts, matching a search. */
  searchCustomTitles(query: string): Promise<string[]> {
    return this.repository.findCustomTitles(query);
  }
}
