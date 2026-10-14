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
  area: string | null;
  city: string;
  district: string;
  state: string;
  pincode: string;
  shopPhotoUrls: string[];
  deliveryAvailable: boolean;
  deliveryPricePerKm: number | null;
  verificationStatus: ProfileVerificationStatus;
  /** Average customer rating of the shop (1 decimal), or null before the first rating. */
  ratingAverage: number | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Admin-facing shape only — joins the owning account's basic contact fields for review context. */
export interface BusinessProfileWithAccount extends BusinessProfile {
  accountFullName: string;
  accountMobileNumber: string;
  accountEmail: string;
}

export interface AdminListFilter {
  status?: ProfileVerificationStatus;
  page: number;
  limit: number;
}

export interface AdminListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface NearbySearchFilter {
  latitude: number;
  longitude: number;
  radiusKm: number;
  query?: string;
  limit: number;
  /** Only shops in this category. */
  shopCategory?: string;
  /** Only shops that offer door delivery. */
  deliveryOnly?: boolean;
  sort?: 'distance' | 'rating';
}

/** Public (non-admin) nearby-search result — a verified profile plus its computed distance from the searcher. */
export interface BusinessNearbyResult extends BusinessProfile {
  distanceMeters: number;
}
