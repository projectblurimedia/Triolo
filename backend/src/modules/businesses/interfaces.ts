const BUSINESS_SHOP_CATEGORIES_LIST = [
  'grocery',
  'restaurant',
  'pharmacy',
  'electronics',
  'clothing',
  'hardware',
  'salon',
  'supermarket',
  'vegetables_fruits',
  'dairy',
  'bakery',
  'sweets',
  'meat_chicken',
  'fish',
  'tea_coffee',
  'tiffin_center',
  'juice_icecream',
  'water_cans',
  'mobile_shop',
  'computer_shop',
  'home_appliances',
  'furniture',
  'footwear',
  'jewellery',
  'cosmetics',
  'gifts_toys',
  'stationery_books',
  'printing_xerox',
  'photo_studio',
  'optical',
  'clinic_lab',
  'beauty_parlour',
  'gym',
  'tailoring',
  'laundry',
  'paints',
  'electricals',
  'sanitary',
  'building_materials',
  'auto_parts',
  'seeds_fertilizers',
  'pet_shop',
  'flowers',
  'gas_agency',
  'hotel_lodge',
  'other',
] as const;

export type BusinessShopCategory = (typeof BUSINESS_SHOP_CATEGORIES_LIST)[number];

export const BUSINESS_SHOP_CATEGORIES: BusinessShopCategory[] = [...BUSINESS_SHOP_CATEGORIES_LIST];

export type ProfileVerificationStatus = 'pending_verification' | 'verified' | 'rejected';

export interface BusinessProfile {
  id: string;
  accountId: string;
  shopName: string;
  shopCategories: BusinessShopCategory[];
  otherCategoryDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The place name shown to people (village / town / locality). */
  locationName: string | null;
  /** The rest of the address is stored for search/admin use but never displayed. */
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  /** The worker's face / the shop's logo. */
  profilePhotoUrl: string | null;
  shopPhotoUrls: string[];
  deliveryAvailable: boolean;
  deliveryPricePerKm: number | null;
  /** Delivery never costs less than this (rupees). */
  deliveryMinCharge: number | null;
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
  /** The account's standing — 'active', 'suspended' or 'blocked'. */
  accountStatus: string;
}

export interface AdminListFilter {
  status?: ProfileVerificationStatus;
  /** Name, mobile number or shop name. */
  q?: string;
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
  /** Subscribed partners' accounts: listed first. */
  priorityAccountIds?: string[];
}

/** Public (non-admin) nearby-search result — a verified profile plus its computed distance from the searcher. */
export interface BusinessNearbyResult extends BusinessProfile {
  distanceMeters: number;
}
