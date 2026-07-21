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
