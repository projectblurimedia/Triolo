import { BusinessShopCategory } from './interfaces';

export interface CreateBusinessProfileDto {
  shopName: string;
  shopCategory: BusinessShopCategory;
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string;
}
