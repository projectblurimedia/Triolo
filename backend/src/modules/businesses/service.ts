import { AppError } from '@/common/errors/AppError';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
import { BusinessesRepository } from './repository';
import { CreateBusinessProfileDto, UpdateBusinessProfileDto } from './dto';
import {
  AdminListFilter,
  AdminListResult,
  BusinessProfile,
  BusinessProfileWithAccount,
  ProfileVerificationStatus,
} from './interfaces';

const SHOP_PHOTO_FOLDER = 'triolo/businesses/shop-photos';

export class BusinessesService {
  constructor(private readonly repository: BusinessesRepository) {}

  async createProfile(
    accountId: string,
    dto: CreateBusinessProfileDto,
    files: Express.Multer.File[],
  ): Promise<BusinessProfile> {
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
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      area: dto.area ?? null,
      city: dto.city,
      district: dto.district,
      state: dto.state,
      pincode: dto.pincode,
      shopPhotoUrls,
      deliveryAvailable: dto.deliveryAvailable,
      deliveryPricePerKm: dto.deliveryAvailable ? (dto.deliveryPricePerKm ?? null) : null,
    });
  }

  async getMyProfile(accountId: string): Promise<BusinessProfile | null> {
    return this.repository.findByAccountId(accountId);
  }

  async updateProfile(
    accountId: string,
    dto: UpdateBusinessProfileDto,
    files: Express.Multer.File[],
  ): Promise<BusinessProfile> {
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
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      area: dto.area ?? null,
      city: dto.city,
      district: dto.district,
      state: dto.state,
      pincode: dto.pincode,
      shopPhotoUrls,
      deliveryAvailable: dto.deliveryAvailable,
      deliveryPricePerKm: dto.deliveryAvailable ? (dto.deliveryPricePerKm ?? null) : null,
      // Edits keep whatever verification status the profile already had — a confirmed
      // reversal of an earlier "any edit resets to pending_verification" design. Admin still
      // sees when a verified profile was last edited via `updatedAt` (set by the repository's
      // `updated_at = now()`), surfaced as plain information, not a re-review gate.
      verificationStatus: existing.verificationStatus,
    });
  }

  async deleteProfile(accountId: string): Promise<void> {
    const existing = await this.repository.findByAccountId(accountId);
    if (!existing) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    await deletePhotosFromCloudinary(existing.shopPhotoUrls);
    await this.repository.remove(accountId);
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
}
