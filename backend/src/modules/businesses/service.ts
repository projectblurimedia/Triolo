import fs from 'fs';
import type { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
import { AppError } from '@/common/errors/AppError';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
import { NotificationsService } from '@/modules/notifications/service';
import { BusinessesRepository } from './repository';
import { CreateBusinessProfileDto, UpdateBusinessProfileDto } from './dto';
import {
  AdminListFilter,
  AdminListResult,
  BusinessNearbyResult,
  BusinessProfile,
  BusinessProfileWithAccount,
  NearbySearchFilter,
  ProfileVerificationStatus,
} from './interfaces';

const SHOP_PHOTO_FOLDER = 'triolo/businesses/shop-photos';
const PROFILE_PHOTO_FOLDER = 'triolo/businesses/profile';

export class BusinessesService {
  constructor(
    private readonly repository: BusinessesRepository,
    private readonly notificationsService: NotificationsService,
    // Subscribed partners' shops come first in searches (optional: tests and admin don't need it).
    private readonly subscriptionStatus?: SubscriptionStatusService,
  ) {}

  async createProfile(accountId: string, dto: CreateBusinessProfileDto, files: Express.Multer.File[]): Promise<BusinessProfile> {
    const existing = await this.repository.findByAccountId(accountId);
    if (existing) {
      throw AppError.conflict('You already have a business profile.', 'BUSINESS_PROFILE_EXISTS');
    }

    const shopPhotoUrls: string[] = [];
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, SHOP_PHOTO_FOLDER);
      shopPhotoUrls.push(uploaded.url);
    }

    return this.repository.create({
      accountId,
      shopName: dto.shopName,
      shopCategories: dto.shopCategories,
      otherCategoryDescription: dto.otherCategoryDescription ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationName: dto.locationName,
      area: dto.area ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      state: dto.state ?? null,
      pincode: dto.pincode ?? null,
      shopPhotoUrls,
      deliveryAvailable: dto.deliveryAvailable,
      deliveryPricePerKm: dto.deliveryAvailable ? (dto.deliveryPricePerKm ?? null) : null,
      // The minimum is the price of 1 km unless one is given, so a delivery under 1 km costs a full km.
      deliveryMinCharge: dto.deliveryAvailable ? (dto.deliveryMinCharge ?? dto.deliveryPricePerKm ?? null) : null,
    });
  }

  /** Public profile (rating included) — never the owner's contact details. */
  async getPublicProfile(id: string): Promise<BusinessProfile | null> {
    const profile = await this.repository.findById(id);
    if (!profile) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose (contact details)
    const { accountFullName, accountMobileNumber, accountEmail, ...rest } = profile;
    return rest;
  }

  async getVerifiedProfiles(ids: string[]): Promise<BusinessProfile[]> {
    return this.repository.findVerifiedByIds(ids);
  }

  /** Adds a customer's 1–5 star rating of the shop (called by the orders module). */
  async recordRating(id: string, stars: number): Promise<void> {
    await this.repository.recordRating(id, stars);
  }

  async getMyProfile(accountId: string): Promise<BusinessProfile | null> {
    return this.repository.findByAccountId(accountId);
  }

  async updateProfile(accountId: string, dto: UpdateBusinessProfileDto, files: Express.Multer.File[]): Promise<BusinessProfile> {
    const existing = await this.repository.findByAccountId(accountId);
    if (!existing) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }

    const newPhotoUrls: string[] = [];
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, SHOP_PHOTO_FOLDER);
      newPhotoUrls.push(uploaded.url);
    }

    const keptPhotoUrls = dto.existingPhotoUrls ?? existing.shopPhotoUrls;
    const shopPhotoUrls = [...keptPhotoUrls, ...newPhotoUrls].slice(0, 6);

    const droppedPhotoUrls = existing.shopPhotoUrls.filter((url) => !keptPhotoUrls.includes(url));
    await deletePhotosFromCloudinary(droppedPhotoUrls);

    return this.repository.update(accountId, {
      shopName: dto.shopName,
      shopCategories: dto.shopCategories,
      otherCategoryDescription: dto.otherCategoryDescription ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationName: dto.locationName,
      area: dto.area ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      state: dto.state ?? null,
      pincode: dto.pincode ?? null,
      shopPhotoUrls,
      deliveryAvailable: dto.deliveryAvailable,
      deliveryPricePerKm: dto.deliveryAvailable ? (dto.deliveryPricePerKm ?? null) : null,
      // The minimum is the price of 1 km unless one is given, so a delivery under 1 km costs a full km.
      deliveryMinCharge: dto.deliveryAvailable ? (dto.deliveryMinCharge ?? dto.deliveryPricePerKm ?? null) : null,
      // Edits keep whatever verification status the profile already had — a confirmed
      // reversal of an earlier "any edit resets to pending_verification" design. Admin still
      // sees when a verified profile was last edited via `updatedAt` (set by the repository's
      // `updated_at = now()`), surfaced as plain information, not a re-review gate.
      verificationStatus: existing.verificationStatus,
    });
  }

  /** Uploads the profile photo (replacing any previous one) — its own request, so the body stays small for Vercel. */
  async setProfilePhoto(accountId: string, file: Express.Multer.File | undefined): Promise<BusinessProfile> {
    if (!file) throw AppError.badRequest('A photo is required.', 'PHOTO_REQUIRED');
    if (!(await this.repository.findByAccountId(accountId))) {
      // uploadToCloudinary would normally remove the temp file; it won't run here.
      fs.promises.unlink(file.path).catch(() => {});
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    const uploaded = await uploadToCloudinary(file.path, PROFILE_PHOTO_FOLDER);
    const result = await this.repository.setProfilePhoto(accountId, uploaded.url);
    if (!result) {
      await deletePhotosFromCloudinary([uploaded.url]);
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.profile;
  }

  async removeProfilePhoto(accountId: string): Promise<BusinessProfile> {
    const result = await this.repository.setProfilePhoto(accountId, null);
    if (!result) throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.profile;
  }

  async deleteProfile(accountId: string): Promise<void> {
    const existing = await this.repository.findByAccountId(accountId);
    if (!existing) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    await deletePhotosFromCloudinary([
      ...existing.shopPhotoUrls,
      ...(existing.profilePhotoUrl ? [existing.profilePhotoUrl] : []),
    ]);
    await this.repository.remove(accountId);
  }

  async searchNearby(accountId: string, filter: NearbySearchFilter): Promise<BusinessNearbyResult[]> {
    const priorityAccountIds = (await this.subscriptionStatus?.priorityPartnerIds('shop')) ?? [];
    return this.repository.findNearby(accountId, { ...filter, priorityAccountIds });
  }

  /** Fired when a user opens this business's detail card from Nearby Shops search. */
  async recordProfileView(id: string, viewerAccountId: string): Promise<void> {
    const profile = await this.repository.findById(id);
    if (!profile) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    await this.notificationsService.notifyProfileViewed(profile.accountId, viewerAccountId, 'shop');
  }

  // --- Admin-facing (called only from modules/admin's service — see WorkersService's own
  // equivalent section for why that's the module-boundary-respecting way to reach this data).

  async adminListProfiles(filter: AdminListFilter): Promise<AdminListResult<BusinessProfileWithAccount>> {
    return this.repository.findAll(filter);
  }

  async adminGetProfile(id: string): Promise<BusinessProfileWithAccount> {
    const profile = await this.repository.findById(id);
    if (!profile) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  async adminSetVerificationStatus(id: string, status: ProfileVerificationStatus): Promise<BusinessProfile> {
    const updated = await this.repository.updateVerificationStatus(id, status);
    if (!updated) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
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
      ...existing.shopPhotoUrls,
      ...(existing.profilePhotoUrl ? [existing.profilePhotoUrl] : []),
    ]);
    await this.repository.remove(accountId);
    return true;
  }

  /** Categories shops typed under "other" that match a search — names only. */
  searchCustomCategories(query: string): Promise<string[]> {
    return this.repository.findCustomCategories(query);
  }
}
