import fs from 'fs';
import { AppError } from '@/common/errors/AppError';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
import { NotificationsService } from '@/modules/notifications/service';
import { WorkersRepository } from './repository';
import { CreateWorkerProfileDto, UpdateWorkerProfileDto } from './dto';
import {
  AdminListFilter,
  AdminListResult,
  NearbySearchFilter,
  ProfileVerificationStatus,
  WorkerBroadcastMatch,
  WorkerNearbyResult,
  WorkerProfile,
  WorkerProfileWithAccount,
} from './interfaces';

const PORTFOLIO_FOLDER = 'triolo/workers/portfolio';
const PROFILE_PHOTO_FOLDER = 'triolo/workers/profile';

export class WorkersService {
  constructor(
    private readonly repository: WorkersRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createProfile(accountId: string, dto: CreateWorkerProfileDto, files: Express.Multer.File[]): Promise<WorkerProfile> {
    const existing = await this.repository.findByAccountId(accountId);
    if (existing) {
      throw AppError.conflict('You already have a worker profile.', 'WORKER_PROFILE_EXISTS');
    }

    const portfolioPhotoUrls: string[] = [];
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, PORTFOLIO_FOLDER);
      portfolioPhotoUrls.push(uploaded.url);
    }

    return this.repository.create({
      accountId,
      skillCategories: dto.skillCategories,
      otherSkillDescription: dto.otherSkillDescription ?? null,
      experienceYears: dto.experienceYears,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationName: dto.locationName,
      area: dto.area ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      state: dto.state ?? null,
      pincode: dto.pincode ?? null,
      portfolioPhotoUrls,
    });
  }

  async getVerifiedProfiles(ids: string[]): Promise<(WorkerProfile & { accountFullName: string })[]> {
    return this.repository.findVerifiedByIds(ids);
  }

  async getMyProfile(accountId: string): Promise<WorkerProfile | null> {
    return this.repository.findByAccountId(accountId);
  }

  /** Public profile fields (rating included) — never the account's contact details. */
  async getPublicProfile(id: string): Promise<WorkerProfile | null> {
    const profile = await this.repository.findById(id);
    if (!profile) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose (contact details)
    const { accountFullName: _name, accountMobileNumber: _mobile, accountEmail: _email, ...rest } = profile;
    return rest;
  }

  async updateProfile(accountId: string, dto: UpdateWorkerProfileDto, files: Express.Multer.File[]): Promise<WorkerProfile> {
    const existing = await this.repository.findByAccountId(accountId);
    if (!existing) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }

    const newPhotoUrls: string[] = [];
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, PORTFOLIO_FOLDER);
      newPhotoUrls.push(uploaded.url);
    }

    const keptPhotoUrls = dto.existingPhotoUrls ?? existing.portfolioPhotoUrls;
    const portfolioPhotoUrls = [...keptPhotoUrls, ...newPhotoUrls].slice(0, 6);

    const droppedPhotoUrls = existing.portfolioPhotoUrls.filter((url) => !keptPhotoUrls.includes(url));
    await deletePhotosFromCloudinary(droppedPhotoUrls);

    return this.repository.update(accountId, {
      skillCategories: dto.skillCategories,
      otherSkillDescription: dto.otherSkillDescription ?? null,
      experienceYears: dto.experienceYears,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationName: dto.locationName,
      area: dto.area ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      state: dto.state ?? null,
      pincode: dto.pincode ?? null,
      portfolioPhotoUrls,
      // Edits keep whatever verification status the profile already had — a confirmed
      // reversal of an earlier "any edit resets to pending_verification" design. Admin still
      // sees when a verified profile was last edited via `updatedAt` (set by the repository's
      // `updated_at = now()`), surfaced as plain information, not a re-review gate.
      verificationStatus: existing.verificationStatus,
    });
  }

  /** Uploads the profile photo (replacing any previous one) — its own request, so the body stays small for Vercel. */
  async setProfilePhoto(accountId: string, file: Express.Multer.File | undefined): Promise<WorkerProfile> {
    if (!file) throw AppError.badRequest('A photo is required.', 'PHOTO_REQUIRED');
    if (!(await this.repository.findByAccountId(accountId))) {
      // uploadToCloudinary would normally remove the temp file; it won't run here.
      fs.promises.unlink(file.path).catch(() => {});
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    const uploaded = await uploadToCloudinary(file.path, PROFILE_PHOTO_FOLDER);
    const result = await this.repository.setProfilePhoto(accountId, uploaded.url);
    if (!result) {
      await deletePhotosFromCloudinary([uploaded.url]);
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.profile;
  }

  async removeProfilePhoto(accountId: string): Promise<WorkerProfile> {
    const result = await this.repository.setProfilePhoto(accountId, null);
    if (!result) throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.profile;
  }

  async deleteProfile(accountId: string): Promise<void> {
    const existing = await this.repository.findByAccountId(accountId);
    if (!existing) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    await deletePhotosFromCloudinary([
      ...existing.portfolioPhotoUrls,
      ...(existing.profilePhotoUrl ? [existing.profilePhotoUrl] : []),
    ]);
    await this.repository.remove(accountId);
  }

  async searchNearby(accountId: string, filter: NearbySearchFilter): Promise<WorkerNearbyResult[]> {
    return this.repository.findNearby(accountId, filter);
  }

  /** Called from modules/problems when a customer rates a finished job (never touches this table itself). */
  async recordRating(workerId: string, stars: number): Promise<void> {
    await this.repository.addRating(workerId, stars);
  }

  /**
   * Called from modules/bookings' `BookingsService` (never touches `worker_profiles`
   * itself) to find every verified worker eligible for a Quick Book broadcast — same
   * module-boundary shape as `admin` calling into this service, just for a different
   * purpose.
   */
  async findMatchingForBroadcast(
    requesterAccountId: string,
    skillCategories: string[],
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<WorkerBroadcastMatch[]> {
    return this.repository.findMatchingForBroadcast(requesterAccountId, skillCategories, latitude, longitude, radiusKm);
  }

  /** Fired when a user opens this worker's detail card from Nearby Workers search. */
  async recordProfileView(id: string, viewerAccountId: string): Promise<void> {
    const profile = await this.repository.findById(id);
    if (!profile) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    await this.notificationsService.notifyProfileViewed(profile.accountId, viewerAccountId);
  }

  // --- Admin-facing (called only from modules/admin's service — see its own doc comment
  // for why that's the module-boundary-respecting way to reach this data).

  async adminListProfiles(filter: AdminListFilter): Promise<AdminListResult<WorkerProfileWithAccount>> {
    return this.repository.findAll(filter);
  }

  async adminGetProfile(id: string): Promise<WorkerProfileWithAccount> {
    const profile = await this.repository.findById(id);
    if (!profile) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  async adminSetVerificationStatus(id: string, status: ProfileVerificationStatus): Promise<WorkerProfile> {
    const updated = await this.repository.updateVerificationStatus(id, status);
    if (!updated) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    return updated;
  }

  adminCounts() {
    return this.repository.adminCounts();
  }

  /** Admin removal of an account's profile (and its photos). False when there was none. */
  async adminDeleteForAccount(accountId: string): Promise<boolean> {
    const existing = await this.repository.findByAccountId(accountId);
    if (!existing) return false;
    await deletePhotosFromCloudinary([
      ...existing.portfolioPhotoUrls,
      ...(existing.profilePhotoUrl ? [existing.profilePhotoUrl] : []),
    ]);
    await this.repository.remove(accountId);
    return true;
  }
}
