import { apiClient } from './apiClient';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type AccountStatus = 'active' | 'suspended' | 'blocked' | 'pending_verification';
export type Verification = 'pending_verification' | 'verified' | 'rejected';

export interface Account {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  role: string;
  status: AccountStatus;
  preferredLanguage: 'en' | 'te';
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  suspendedUntil: string | null;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerProfile {
  id: string;
  accountId: string;
  skillCategories: string[];
  otherSkillDescription: string | null;
  experienceYears: number;
  latitude: number | null;
  longitude: number | null;
  /** The place name shown to people (village / town). The rest of the address is stored, never shown. */
  locationName: string | null;
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  profilePhotoUrl: string | null;
  portfolioPhotoUrls: string[];
  verificationStatus: Verification;
  ratingAverage: number | null;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfile {
  id: string;
  accountId: string;
  shopName: string;
  shopCategories: string[];
  otherCategoryDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The place name shown to people (village / town). The rest of the address is stored, never shown. */
  locationName: string | null;
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  profilePhotoUrl: string | null;
  shopPhotoUrls: string[];
  deliveryAvailable: boolean;
  deliveryPricePerKm: number | null;
  deliveryMinCharge: number | null;
  verificationStatus: Verification;
  ratingAverage: number | null;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WithAccount {
  accountFullName: string;
  accountMobileNumber: string;
  accountEmail: string | null;
  accountStatus: AccountStatus;
}

export type AdminWorker = WorkerProfile & WithAccount;
export type AdminShop = BusinessProfile & WithAccount;

export interface JobPost {
  id: string;
  accountId: string;
  category: string;
  title: string;
  payAmount: number;
  payPeriod: 'daily' | 'monthly';
  availability: 'full_time' | 'part_time' | 'live_in';
  experienceYears: number;
  skills: string[];
  description: string | null;
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminJobPost extends JobPost {
  fullName: string;
  mobileNumber: string;
  accountStatus: AccountStatus;
}

export type BookingStatus =
  'broadcasting' | 'accepted' | 'on_the_way' | 'arrived' | 'in_progress' | 'work_done' | 'completed' | 'cancelled' | 'expired';

export interface AdminBooking {
  id: string;
  accountId: string;
  skillCategories: string[];
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  radiusKm: number;
  status: BookingStatus;
  acceptedAt: string | null;
  startedAt: string | null;
  arrivedAt: string | null;
  pinVerifiedAt: string | null;
  workDoneAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: 'customer' | 'worker' | 'admin' | null;
  cancelReason: string | null;
  expiredAt: string | null;
  workerRating: number | null;
  workerReview: string | null;
  problemPostId: string | null;
  quotationAmount: number | null;
  createdAt: string;
  customer: { accountId: string; fullName: string; mobileNumber: string };
  worker: { accountId: string; workerId: string; fullName: string; mobileNumber: string } | null;
  offerCount: number;
}

export interface AdminBookingDetail extends AdminBooking {
  offers: {
    workerId: string;
    fullName: string;
    mobileNumber: string;
    distanceMeters: number;
    status: 'pending' | 'accepted' | 'lost' | 'declined';
    createdAt: string;
  }[];
}

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'packed'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'expired';

export interface AdminOrder {
  id: string;
  accountId: string;
  businessId: string;
  fulfillment: 'pickup' | 'delivery';
  status: OrderStatus;
  locationAddress: string | null;
  distanceMeters: number;
  deliveryCharge: number;
  itemsTotal: number | null;
  totalAmount: number | null;
  note: string | null;
  cancelledBy: 'customer' | 'shop' | 'admin' | null;
  cancelReason: string | null;
  shopRating: number | null;
  shopReview: string | null;
  acceptedAt: string | null;
  packedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  declinedAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  items: {
    id: string;
    name: string;
    quantity: string;
    unit: string | null;
    status: 'pending' | 'packed' | 'unavailable';
    price: number | null;
  }[];
  customer: { accountId: string; fullName: string; mobileNumber: string };
  shop: { businessId: string; accountId: string; name: string; ownerName: string; mobileNumber: string };
}

export type ProblemStatus = 'open' | 'accepted' | 'work_done' | 'completed' | 'closed';

export interface AdminProblem {
  id: string;
  accountId: string;
  skillCategories: string[];
  description: string | null;
  quotationAmount: number;
  photoUrls: string[];
  locationAddress: string | null;
  status: ProblemStatus;
  acceptedAt: string | null;
  completedAt: string | null;
  workerRating: number | null;
  workerReview: string | null;
  bookingRequestId: string | null;
  createdAt: string;
  customerFullName: string;
  customerMobileNumber: string;
  workerFullName: string | null;
  workerMobileNumber: string | null;
  closedReason: string | null;
  closedAt: string | null;
}

export interface AccountDetail {
  account: Account;
  workerProfile: WorkerProfile | null;
  businessProfile: BusinessProfile | null;
  jobPost: JobPost | null;
  bookings: AdminBooking[];
  orders: AdminOrder[];
  problems: AdminProblem[];
}

export interface Stats {
  accounts: { total: number; active: number; suspended: number; blocked: number; newToday: number };
  workers: { total: number; pending: number; verified: number; rejected: number };
  businesses: { total: number; pending: number; verified: number; rejected: number };
  jobPosts: { total: number; live: number };
  bookings: { active: number; searching: number; completed: number; cancelled: number; today: number };
  orders: { new: number; active: number; completed: number; cancelled: number; today: number };
  problems: { open: number; inProgress: number; completed: number; closed: number };
}

/** Builds a query string, skipping empty values. */
function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

type ListParams = Record<string, string | number | boolean | undefined | null>;

export const adminApi = {
  stats: () => apiClient.get<Stats>('/admin/stats', true),

  accounts: (params: ListParams) => apiClient.get<Page<Account>>(`/admin/accounts${qs(params)}`, true),
  account: (id: string) => apiClient.get<AccountDetail>(`/admin/accounts/${id}`, true),
  moderate: (id: string, body: { action: 'suspend' | 'ban' | 'reactivate'; days?: number; reason?: string }) =>
    apiClient.patch<Account>(`/admin/accounts/${id}/status`, body, true),
  removeProfiles: (id: string, reason?: string) =>
    apiClient.post<{ removed: { worker: boolean; shop: boolean; jobPost: boolean } }>(
      `/admin/accounts/${id}/remove-profiles`,
      { reason },
      true,
    ),

  workers: (params: ListParams) => apiClient.get<Page<AdminWorker>>(`/admin/workers${qs(params)}`, true),
  worker: (id: string) => apiClient.get<AdminWorker>(`/admin/workers/${id}`, true),
  verifyWorker: (id: string, status: 'verified' | 'rejected') =>
    apiClient.patch<WorkerProfile>(`/admin/workers/${id}/verification`, { status }, true),

  shops: (params: ListParams) => apiClient.get<Page<AdminShop>>(`/admin/businesses${qs(params)}`, true),
  shop: (id: string) => apiClient.get<AdminShop>(`/admin/businesses/${id}`, true),
  verifyShop: (id: string, status: 'verified' | 'rejected') =>
    apiClient.patch<BusinessProfile>(`/admin/businesses/${id}/verification`, { status }, true),

  bookings: (params: ListParams) => apiClient.get<Page<AdminBooking>>(`/admin/bookings${qs(params)}`, true),
  booking: (id: string) => apiClient.get<AdminBookingDetail>(`/admin/bookings/${id}`, true),
  cancelBooking: (id: string, reason?: string) =>
    apiClient.post<AdminBookingDetail>(`/admin/bookings/${id}/cancel`, { reason }, true),

  orders: (params: ListParams) => apiClient.get<Page<AdminOrder>>(`/admin/orders${qs(params)}`, true),
  order: (id: string) => apiClient.get<AdminOrder>(`/admin/orders/${id}`, true),
  cancelOrder: (id: string, reason?: string) => apiClient.post<AdminOrder>(`/admin/orders/${id}/cancel`, { reason }, true),

  problems: (params: ListParams) => apiClient.get<Page<AdminProblem>>(`/admin/problems${qs(params)}`, true),
  problem: (id: string) => apiClient.get<AdminProblem>(`/admin/problems/${id}`, true),
  closeProblem: (id: string, reason?: string) => apiClient.post<AdminProblem>(`/admin/problems/${id}/close`, { reason }, true),

  jobPosts: (params: ListParams) => apiClient.get<Page<AdminJobPost>>(`/admin/job-posts${qs(params)}`, true),
  jobPost: (id: string) => apiClient.get<AdminJobPost>(`/admin/job-posts/${id}`, true),
  setJobPostActive: (id: string, isActive: boolean, reason?: string) =>
    apiClient.patch<AdminJobPost>(`/admin/job-posts/${id}/active`, { isActive, reason }, true),
  removeJobPost: (id: string, reason?: string) => apiClient.post<null>(`/admin/job-posts/${id}/remove`, { reason }, true),
};
