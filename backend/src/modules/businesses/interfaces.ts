export type BusinessShopCategory =
  | 'grocery'
  | 'restaurant'
  | 'pharmacy'
  | 'electronics'
  | 'clothing'
  | 'hardware'
  | 'salon'
  | 'other';

export const BUSINESS_SHOP_CATEGORIES: BusinessShopCategory[] = [
  'grocery',
  'restaurant',
  'pharmacy',
  'electronics',
  'clothing',
  'hardware',
  'salon',
  'other',
];

export type ProfileVerificationStatus = 'pending_verification' | 'verified' | 'rejected';

export interface BusinessProfile {
  id: string;
  accountId: string;
  shopName: string;
  shopCategories: BusinessShopCategory[];
  otherCategoryDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  shopPhotoUrls: string[];
  deliveryAvailable: boolean;
  deliveryPricePerKm: number | null;
  verificationStatus: ProfileVerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}
