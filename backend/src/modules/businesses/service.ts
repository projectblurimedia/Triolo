import { AppError } from '@/common/errors/AppError';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
import { BusinessesRepository } from './repository';
import { CreateBusinessProfileDto, UpdateBusinessProfileDto } from './dto';
import { BusinessProfile } from './interfaces';

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
      locationAddress: dto.locationAddress ?? null,
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
      locationAddress: dto.locationAddress ?? null,
      shopPhotoUrls,
      deliveryAvailable: dto.deliveryAvailable,
      deliveryPricePerKm: dto.deliveryAvailable ? (dto.deliveryPricePerKm ?? null) : null,
      // Edited details haven't been reviewed yet — an already-verified shop changing
      // its details shouldn't stay "verified" for the new, unreviewed details.
      verificationStatus: 'pending_verification',
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
}
