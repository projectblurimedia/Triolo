import type { AuthService } from '@/modules/auth/service';
import type { WorkersService } from '@/modules/workers/service';
import type { BusinessesService } from '@/modules/businesses/service';
import type { JobSeekersService } from '@/modules/jobSeekers/service';
import type { BookingsService } from '@/modules/bookings/service';
import type { OrdersService } from '@/modules/orders/service';
import type { ProblemsService } from '@/modules/problems/service';
import type { NotificationsService } from '@/modules/notifications/service';

export interface AccountDeletionDeps {
  auth: Pick<AuthService, 'markDeleted' | 'purgeDeleted'>;
  workers: Pick<WorkersService, 'adminDeleteForAccount'>;
  businesses: Pick<BusinessesService, 'adminDeleteForAccount'>;
  jobSeekers: Pick<JobSeekersService, 'adminDeleteForAccount'>;
  bookings: Pick<BookingsService, 'adminCancelActiveForAccount'>;
  orders: Pick<OrdersService, 'adminCancelActiveForAccount' | 'purgeMediaForAccount' | 'purgeOldMedia'>;
  problems: Pick<ProblemsService, 'adminCloseOpenForAccount' | 'clearPhotosForAccount'>;
  notifications: Pick<NotificationsService, 'removeAllForAccount'>;
}

/** Said to the other side of anything cancelled because the account was deleted. */
const DELETED_REASON = 'The account was deleted';

/**
 * A person deleting their own account (Profile → Delete account, or the website). Owns no tables:
 * like `admin`, it only calls the owning modules' services.
 *
 *  - At once: every booking / order / problem still under way is cancelled (the other side is
 *    told), the worker / shop / job post profiles and every photo and voice message are deleted,
 *    notifications and push tokens removed, and the account is stopped and signed out.
 *  - 30 days later (daily job): the account's name, number, email, place and photo are wiped. The
 *    rows stay so other people's past orders and jobs read "Deleted user".
 */
export class AccountDeletionService {
  constructor(private readonly deps: AccountDeletionDeps) {}

  async deleteMyAccount(accountId: string): Promise<void> {
    const { auth, workers, businesses, jobSeekers, bookings, orders, problems, notifications } = this.deps;
    await bookings.adminCancelActiveForAccount(accountId, DELETED_REASON);
    await orders.adminCancelActiveForAccount(accountId, DELETED_REASON);
    await problems.adminCloseOpenForAccount(accountId, DELETED_REASON);
    await Promise.all([
      workers.adminDeleteForAccount(accountId),
      businesses.adminDeleteForAccount(accountId),
      jobSeekers.adminDeleteForAccount(accountId),
      problems.clearPhotosForAccount(accountId),
      orders.purgeMediaForAccount(accountId),
      notifications.removeAllForAccount(accountId),
    ]);
    await auth.markDeleted(accountId);
  }

  /** Daily (Vercel Cron): accounts deleted 30+ days ago are wiped; old orders lose their media. */
  async dailyCleanup(): Promise<{ accountsWiped: number; ordersCleared: number }> {
    const accountsWiped = await this.deps.auth.purgeDeleted();
    const ordersCleared = await this.deps.orders.purgeOldMedia();
    return { accountsWiped, ordersCleared };
  }
}
