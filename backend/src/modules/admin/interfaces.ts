import { Account, AccountModerationAction } from '@/modules/auth/interfaces';
import { WorkerProfile } from '@/modules/workers/interfaces';
import { BusinessProfile } from '@/modules/businesses/interfaces';
import { JobSeekerPost } from '@/modules/jobSeekers/interfaces';
import { AdminBooking } from '@/modules/bookings/interfaces';
import { AdminOrder } from '@/modules/orders/interfaces';
import { AdminProblemPost } from '@/modules/problems/interfaces';

export type VerificationDecision = 'verified' | 'rejected';

/** Everything the admin needs to know about one person, on one page. */
export interface AdminAccountDetail {
  account: Account;
  workerProfile: WorkerProfile | null;
  businessProfile: BusinessProfile | null;
  jobPost: JobSeekerPost | null;
  bookings: AdminBooking[];
  orders: AdminOrder[];
  problems: AdminProblemPost[];
}

export interface ModerateAccountDto {
  action: AccountModerationAction;
  /** Suspension length (suspend only). */
  days?: number;
  reason?: string;
}

/** The dashboard's numbers. */
export interface AdminStats {
  accounts: { total: number; active: number; suspended: number; blocked: number; newToday: number };
  workers: { total: number; pending: number; verified: number; rejected: number };
  businesses: { total: number; pending: number; verified: number; rejected: number };
  jobPosts: { total: number; live: number };
  bookings: { active: number; searching: number; completed: number; cancelled: number; today: number };
  orders: { new: number; active: number; completed: number; cancelled: number; today: number };
  problems: { open: number; inProgress: number; completed: number; closed: number };
}
