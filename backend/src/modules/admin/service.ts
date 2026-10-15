import { AppError } from '@/common/errors/AppError';
import { AuthService } from '@/modules/auth/service';
import { AccountStatus } from '@/modules/auth/interfaces';
import { WorkersService } from '@/modules/workers/service';
import { BusinessesService } from '@/modules/businesses/service';
import { JobSeekersService } from '@/modules/jobSeekers/service';
import { BookingsService } from '@/modules/bookings/service';
import { OrdersService } from '@/modules/orders/service';
import { ProblemsService } from '@/modules/problems/service';
import { NotificationsService } from '@/modules/notifications/service';
import { AdminListFilter as WorkerAdminListFilter } from '@/modules/workers/interfaces';
import { AdminListFilter as BusinessAdminListFilter } from '@/modules/businesses/interfaces';
import { AdminBookingListFilter } from '@/modules/bookings/interfaces';
import { AdminOrderListFilter } from '@/modules/orders/interfaces';
import { AdminProblemListFilter } from '@/modules/problems/interfaces';
import { AdminJobSeekerListFilter } from '@/modules/jobSeekers/interfaces';
import { AdminAccountDetail, AdminStats, ModerateAccountDto, VerificationDecision } from './interfaces';
import { adminNotice, AdminNoticeEvent } from './notices';

export interface AdminDependencies {
  auth: AuthService;
  workers: WorkersService;
  businesses: BusinessesService;
  jobSeekers: JobSeekersService;
  bookings: BookingsService;
  orders: OrdersService;
  problems: ProblemsService;
  notifications: NotificationsService;
}

const DETAIL_LIST_LIMIT = 25;

/**
 * The admin website's backend. Owns no tables: every read and change goes through the owning
 * module's service (accounts → auth, profiles → workers/businesses, job posts → jobSeekers,
 * trips → bookings, shop orders → orders, problem posts → problems), the same module-boundary
 * rule as everywhere else. What it adds is orchestration — e.g. a ban also stops that person's
 * unfinished bookings and orders and closes their open problem posts — and telling the
 * affected person, in their own language, what the admin did and why.
 */
export class AdminService {
  constructor(private readonly deps: AdminDependencies) {}

  // --- Dashboard ---

  async getStats(): Promise<AdminStats> {
    const { auth, workers, businesses, jobSeekers, bookings, orders, problems } = this.deps;
    const [accounts, workerCounts, businessCounts, jobPosts, bookingCounts, orderCounts, problemCounts] = await Promise.all([
      auth.adminStats(),
      workers.adminCounts(),
      businesses.adminCounts(),
      jobSeekers.adminCounts(),
      bookings.adminCounts(),
      orders.adminCounts(),
      problems.adminCounts(),
    ]);
    return {
      accounts,
      workers: workerCounts,
      businesses: businessCounts,
      jobPosts,
      bookings: bookingCounts,
      orders: orderCounts,
      problems: problemCounts,
    };
  }

  // --- Accounts ---

  listAccounts(filter: { q?: string; status?: AccountStatus; page: number; limit: number }) {
    return this.deps.auth.adminListAccounts(filter);
  }

  async getAccount(accountId: string): Promise<AdminAccountDetail> {
    const { auth, workers, businesses, jobSeekers, bookings, orders, problems } = this.deps;
    const account = await auth.adminGetAccount(accountId);
    const page = { accountId, page: 1, limit: DETAIL_LIST_LIMIT };
    const [workerProfile, businessProfile, jobPost, bookingList, orderList, problemList] = await Promise.all([
      workers.getMyProfile(accountId),
      businesses.getMyProfile(accountId),
      jobSeekers.getMine(accountId),
      bookings.adminList(page),
      orders.adminList(page),
      problems.adminList(page),
    ]);
    return {
      account,
      workerProfile,
      businessProfile,
      jobPost,
      bookings: bookingList.items,
      orders: orderList.items,
      problems: problemList.items,
    };
  }

  /**
   * Suspend for some days, ban permanently, or reactivate. Suspending or banning signs the
   * person out everywhere and stops what they were in the middle of: their unfinished
   * bookings and shop orders are cancelled (the other side is told) and their open problem
   * posts are closed.
   */
  async moderateAccount(accountId: string, dto: ModerateAccountDto) {
    const reason = dto.reason?.trim() || null;
    const account = await this.deps.auth.adminModerate(accountId, dto.action, { days: dto.days, reason });
    if (dto.action !== 'reactivate') await this.stopActivity(accountId, reason);
    const event: AdminNoticeEvent = dto.action === 'suspend' ? 'suspended' : dto.action === 'ban' ? 'banned' : 'reactivated';
    await this.tell(accountId, event, { days: dto.days, reason: dto.action === 'reactivate' ? null : reason });
    return account;
  }

  /**
   * "Delete": removes the person's worker, shop and job post profiles (with their photos) and
   * bans the account. Their past bookings and orders stay, so other people's history and
   * ratings are kept.
   */
  async removeProfiles(accountId: string, reasonText?: string) {
    const reason = reasonText?.trim() || null;
    const { auth, workers, businesses, jobSeekers } = this.deps;
    const target = await auth.adminGetAccount(accountId);
    if (target.role === 'admin') {
      throw AppError.forbidden('Admin accounts cannot be removed.', 'ADMIN_ACCOUNT_PROTECTED');
    }
    await this.stopActivity(accountId, reason);
    const [worker, shop, jobPost] = await Promise.all([
      workers.adminDeleteForAccount(accountId),
      businesses.adminDeleteForAccount(accountId),
      jobSeekers.adminDeleteForAccount(accountId),
    ]);
    const account = await auth.adminModerate(accountId, 'ban', { reason });
    await this.tell(accountId, 'profiles_removed', { reason });
    return { account, removed: { worker, shop, jobPost } };
  }

  private async stopActivity(accountId: string, reason: string | null): Promise<void> {
    await this.deps.bookings.adminCancelActiveForAccount(accountId, reason);
    await this.deps.orders.adminCancelActiveForAccount(accountId, reason);
    await this.deps.problems.adminCloseOpenForAccount(accountId, reason);
  }

  // --- Worker / shop verification ---

  listWorkers(filter: WorkerAdminListFilter) {
    return this.deps.workers.adminListProfiles(filter);
  }

  getWorker(id: string) {
    return this.deps.workers.adminGetProfile(id);
  }

  setWorkerVerification(id: string, status: VerificationDecision) {
    return this.deps.workers.adminSetVerificationStatus(id, status);
  }

  listBusinesses(filter: BusinessAdminListFilter) {
    return this.deps.businesses.adminListProfiles(filter);
  }

  getBusiness(id: string) {
    return this.deps.businesses.adminGetProfile(id);
  }

  setBusinessVerification(id: string, status: VerificationDecision) {
    return this.deps.businesses.adminSetVerificationStatus(id, status);
  }

  // --- Bookings (Quick Book and problem trips) ---

  listBookings(filter: AdminBookingListFilter) {
    return this.deps.bookings.adminList(filter);
  }

  getBooking(id: string) {
    return this.deps.bookings.adminGet(id);
  }

  async cancelBooking(id: string, reason?: string) {
    await this.deps.bookings.adminCancel(id, reason?.trim() || null);
    return this.deps.bookings.adminGet(id);
  }

  // --- Shop orders ---

  listOrders(filter: AdminOrderListFilter) {
    return this.deps.orders.adminList(filter);
  }

  getOrder(id: string) {
    return this.deps.orders.adminGet(id);
  }

  async cancelOrder(id: string, reason?: string) {
    await this.deps.orders.adminCancel(id, reason?.trim() || null);
    return this.deps.orders.adminGet(id);
  }

  // --- Problem posts ---

  listProblems(filter: AdminProblemListFilter) {
    return this.deps.problems.adminList(filter);
  }

  getProblem(id: string) {
    return this.deps.problems.adminGet(id);
  }

  async closeProblem(id: string, reasonText?: string) {
    const reason = reasonText?.trim() || null;
    const post = await this.deps.problems.adminClose(id, reason);
    await this.tell(post.accountId, 'problem_closed', { reason });
    return this.deps.problems.adminGet(id);
  }

  // --- Job posts ---

  listJobPosts(filter: AdminJobSeekerListFilter) {
    return this.deps.jobSeekers.adminList(filter);
  }

  getJobPost(id: string) {
    return this.deps.jobSeekers.adminGet(id);
  }

  async setJobPostActive(id: string, isActive: boolean, reasonText?: string) {
    const reason = reasonText?.trim() || null;
    const post = await this.deps.jobSeekers.adminSetActive(id, isActive);
    await this.tell(post.accountId, isActive ? 'job_post_shown' : 'job_post_hidden', { reason: isActive ? null : reason });
    return post;
  }

  async removeJobPost(id: string, reasonText?: string) {
    const reason = reasonText?.trim() || null;
    const accountId = await this.deps.jobSeekers.adminDelete(id);
    await this.tell(accountId, 'job_post_removed', { reason });
  }

  // --- Helpers ---

  /** Saved in the person's notifications and pushed, in their language. Best-effort. */
  private async tell(accountId: string, event: AdminNoticeEvent, values: { days?: number; reason?: string | null }) {
    try {
      const account = await this.deps.auth.adminGetAccount(accountId);
      const text = adminNotice(event, account.preferredLanguage, values);
      await this.deps.notifications.notify(accountId, 'admin_notice', text.title, text.body, {
        data: { kind: 'admin_notice' },
        channelId: 'default',
      });
    } catch {
      // The admin's action already happened; a failed notice must not undo or block it.
    }
  }
}
