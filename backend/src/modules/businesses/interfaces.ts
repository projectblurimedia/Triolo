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
  shopCategory: BusinessShopCategory;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  shopPhotoUrls: string[];
  verificationStatus: ProfileVerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}
