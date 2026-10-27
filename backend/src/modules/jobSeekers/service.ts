import fs from 'fs';
import type { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
import type { NotificationsService } from '@/modules/notifications/service';
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
  JobPostViewers,
} from './interfaces';

const PHOTO_FOLDER = 'triolo/job-seekers';
// How many posts one partner may keep (e.g. tutor, cook, driver…). Decided without asking — reversible.
export const MAX_JOB_POSTS = 5;

/**
 * "Looking for work" posts (Job Seekers). Owns `job_seeker_posts` and depends on no other
 * module. A partner may keep several posts (one per kind of work), each published — and paid for —
 * on its own; customers find nearby posts and call the poster directly. The older one-post
 * routes act on the partner's first post, for app builds that still use them.
 */
export class JobSeekersService {
  constructor(
    private readonly repository: JobSeekersRepository,
    // Subscribed partners' posts come first in searches (optional: tests and admin don't need it).
    private readonly subscriptionStatus?: SubscriptionStatusService,
    // Tells the poster someone viewed their post (optional for the same reason).
    private readonly notifications?: NotificationsService,
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

  /** The partner's first post (older app builds and single-post callers). */
  getMine(accountId: string): Promise<JobSeekerPost | null> {
    return this.repository.findByAccount(accountId);
  }

  listMine(accountId: string): Promise<JobSeekerPost[]> {
    return this.repository.listByAccount(accountId);
  }

  private clean(params: SaveJobSeekerPostParams): SaveJobSeekerPostParams {
    const skills = [...new Set(params.skills.map((skill) => skill.trim()).filter(Boolean))];
    const description = params.description?.trim() ? params.description.trim() : null;
    return { ...params, skills, description };
  }

  /** A new post: each one takes its own paid pass (while partner plans are on). */
  async createMine(accountId: string, params: SaveJobSeekerPostParams): Promise<JobSeekerPost> {
    if ((await this.repository.countByAccount(accountId)) >= MAX_JOB_POSTS) {
      throw AppError.conflict(`You can keep up to ${MAX_JOB_POSTS} job posts.`, 'JOB_POST_LIMIT');
    }
    const passId = (await this.subscriptionStatus?.usePartnerPass(accountId, 'job_post')) ?? null;
    try {
      const post = await this.repository.create(accountId, this.clean(params));
      await this.subscriptionStatus?.attachPass(passId, post.id);
      return post;
    } catch (error) {
      await this.subscriptionStatus?.restorePasses([], [passId]);
      throw error;
    }
  }

  async updateMine(accountId: string, id: string, params: SaveJobSeekerPostParams): Promise<JobSeekerPost> {
    const post = await this.repository.update(accountId, id, this.clean(params));
    if (!post) throw AppError.notFound('Job post not found.', 'JOB_POST_NOT_FOUND');
    return post;
  }

  /** Older builds' PUT /me: edits the first post, or creates one when there's none. */
  async saveMine(accountId: string, params: SaveJobSeekerPostParams): Promise<JobSeekerPost> {
    const first = await this.repository.findByAccount(accountId);
    return first ? this.updateMine(accountId, first.id, params) : this.createMine(accountId, params);
  }

  /** The post to act on: the one named, or (older builds) the first. */
  private async targetId(accountId: string, id?: string): Promise<string> {
    if (id) return id;
    const first = await this.repository.findByAccount(accountId);
    if (!first) throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    return first.id;
  }

  async setActive(accountId: string, isActive: boolean, id?: string): Promise<JobSeekerPost> {
    const post = await this.repository.setActive(accountId, await this.targetId(accountId, id), isActive);
    if (!post) throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    return post;
  }

  async deleteMine(accountId: string, id?: string): Promise<void> {
    const deleted = await this.repository.delete(accountId, await this.targetId(accountId, id));
    if (!deleted) throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    if (deleted.photoUrl) await deletePhotosFromCloudinary([deleted.photoUrl]);
  }

  /** Uploads a new photo for one of the caller's posts (replacing its previous one). */
  async setPhoto(accountId: string, file: Express.Multer.File | undefined, id?: string): Promise<JobSeekerPost> {
    if (!file) throw AppError.badRequest('A photo is required.', 'PHOTO_REQUIRED');
    const postId = id ?? (await this.repository.findByAccount(accountId))?.id;
    if (!postId || !(await this.repository.findOwned(accountId, postId))) {
      // uploadToCloudinary would normally remove the temp file; it won't run here.
      fs.promises.unlink(file.path).catch(() => {});
      throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    }
    const uploaded = await uploadToCloudinary(file.path, PHOTO_FOLDER);
    const result = await this.repository.setPhoto(accountId, postId, uploaded.url);
    if (!result) {
      await deletePhotosFromCloudinary([uploaded.url]);
      throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    }
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.post;
  }

  async removePhoto(accountId: string, id?: string): Promise<JobSeekerPost> {
    const result = await this.repository.setPhoto(accountId, await this.targetId(accountId, id), null);
    if (!result) throw AppError.notFound('You have no job post yet', 'JOB_POST_NOT_FOUND');
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.post;
  }

  /** Counts a customer opening a post (the poster's own views never count). */
  async recordView(id: string, viewerAccountId: string): Promise<void> {
    const view = await this.repository.recordView(id, viewerAccountId);
    if (view?.firstToday) {
      await this.notifications
        ?.notifyJobPostViewed(view.ownerAccountId, viewerAccountId, { id, title: view.title })
        .catch(() => undefined);
    }
  }

  /**
   * Who opened one of my posts. Without the job post plan the people are hidden (the count
   * and times still show) and the app offers the plan.
   */
  async listViewers(accountId: string, postId: string): Promise<JobPostViewers> {
    const viewers = await this.repository.listViewers(accountId, postId);
    if (!viewers) throw AppError.notFound('Job post not found.', 'JOB_POST_NOT_FOUND');
    const locked = !(await this.subscriptionStatus?.revealsProfileViewers(accountId, 'job_post'));
    return {
      locked,
      total: viewers.reduce((sum, viewer) => sum + viewer.times, 0),
      newCount: viewers.filter((viewer) => viewer.isNew).length,
      viewers: viewers.map((viewer, index) => (locked ? { ...viewer, viewerKey: String(index), name: null, mobile: null } : viewer)),
    };
  }

  /** The poster looked at a post's views: they're no longer new, and its notifications are read. */
  async markViewsSeen(accountId: string, postId: string): Promise<void> {
    await this.repository.markViewsSeen(accountId, postId);
    await this.notifications?.markReadByRef(accountId, 'job_post', postId).catch(() => undefined);
  }

  async search(accountId: string, params: JobSeekerSearchParams): Promise<JobSeekerSearchResult[]> {
    const priorityAccountIds = (await this.subscriptionStatus?.priorityPartnerIds('job_post')) ?? [];
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
    const photos = await this.repository.deleteAllForAccount(accountId);
    const urls = photos.filter((url): url is string => !!url);
    if (urls.length > 0) await deletePhotosFromCloudinary(urls);
    return photos.length > 0;
  }

  adminCounts() {
    return this.repository.adminCounts();
  }

  /** Kinds of work people typed themselves ("other") on live posts, matching a search. */
  searchCustomTitles(query: string): Promise<string[]> {
    return this.repository.findCustomTitles(query);
  }
}
