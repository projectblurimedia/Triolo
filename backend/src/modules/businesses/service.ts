import { AppError } from '@/common/errors/AppError';
import { uploadToCloudinary } from '@/common/services/cloudinaryService';
import { BusinessesRepository } from './repository';
import { CreateBusinessProfileDto } from './dto';
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
}
