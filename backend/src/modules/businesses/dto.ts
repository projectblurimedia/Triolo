import { BusinessShopCategory } from './interfaces';

export interface CreateBusinessProfileDto {
  shopName: string;
  shopCategories: BusinessShopCategory[];
  otherCategoryDescription?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string;
  deliveryAvailable: boolean;
  deliveryPricePerKm?: number;
}

export interface UpdateBusinessProfileDto extends CreateBusinessProfileDto {
  /** Existing shop photo URLs the caller wants to keep — anything omitted is dropped, newly uploaded files are appended (capped at 6 total). */
  existingPhotoUrls?: string[];
}
