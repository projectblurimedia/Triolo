import { BusinessShopCategory } from './interfaces';

export interface CreateBusinessProfileDto {
  shopName: string;
  shopCategories: BusinessShopCategory[];
  otherCategoryDescription?: string;
  latitude: number;
  longitude: number;
  /** The place name shown to people (village / town / locality). */
  locationName: string;
  /** The rest of the reverse-geocoded address — stored, never shown. */
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  deliveryAvailable: boolean;
  deliveryPricePerKm?: number;
  deliveryMinCharge?: number;
}

export interface UpdateBusinessProfileDto extends CreateBusinessProfileDto {
  /** Existing shop photo URLs the caller wants to keep — anything omitted is dropped, newly uploaded files are appended (capped at 6 total). */
  existingPhotoUrls?: string[];
}
