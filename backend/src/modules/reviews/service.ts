import { AppError } from '@/common/errors/AppError';
import { WorkersService } from '@/modules/workers/service';
import { BookingsService } from '@/modules/bookings/service';
import { ProblemsService } from '@/modules/problems/service';
import { BusinessesService } from '@/modules/businesses/service';
import { OrdersService } from '@/modules/orders/service';
import { WorkerReview, WorkerReviewsSummary } from './interfaces';

// Enough history for the star breakdown to be meaningful without paging yet.
const RATED_JOBS_LIMIT = 200;
const REVIEWS_SHOWN = 30;

/** "Ravi Kumar" → "Ravi K." — a reviewer is named, but not identifiable by full name. */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/**
 * A worker's ratings and written feedback, gathered from every kind of finished job:
 * Quick Book trips and problem jobs (which now run as trips too) come from bookings, and
 * problem jobs finished before that come from problems. Owns no tables — it only reads
 * through those modules' services, same shape as `admin`.
 */
export class ReviewsService {
  constructor(
    private readonly workersService: WorkersService,
    private readonly bookingsService: BookingsService,
    private readonly problemsService: ProblemsService,
    private readonly businessesService: BusinessesService,
    private readonly ordersService: OrdersService,
  ) {}

  /** A shop's ratings and feedback, from its completed, rated orders. */
  async getForBusiness(businessId: string): Promise<WorkerReviewsSummary> {
    const shop = await this.businessesService.getPublicProfile(businessId);
    if (!shop) {
      throw AppError.notFound('Shop not found.', 'SHOP_NOT_FOUND');
    }
    return this.summarizeShop(businessId, shop.ratingAverage, shop.ratingCount);
  }

  async getForMyShop(accountId: string, shopId?: string): Promise<WorkerReviewsSummary> {
    const shop = await this.businessesService.getMyProfile(accountId, shopId);
    if (!shop) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    return this.summarizeShop(shop.id, shop.ratingAverage, shop.ratingCount);
  }

  private async summarizeShop(
    businessId: string,
    ratingAverage: number | null,
    ratingCount: number,
  ): Promise<WorkerReviewsSummary> {
    const orders = await this.ordersService.listRatedOrdersForBusiness(businessId, RATED_JOBS_LIMIT);
    return summarize(
      orders.map((order) => ({ ...order, skillCategories: [] })),
      ratingAverage,
      ratingCount,
    );
  }

  async getForWorker(workerId: string): Promise<WorkerReviewsSummary> {
    const profile = await this.workersService.getPublicProfile(workerId);
    if (!profile) {
      throw AppError.notFound('Worker not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    return this.summarizeWorker(workerId, profile.ratingAverage, profile.ratingCount);
  }

  async getForMe(accountId: string): Promise<WorkerReviewsSummary> {
    const profile = await this.workersService.getMyProfile(accountId);
    if (!profile) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    return this.summarizeWorker(profile.id, profile.ratingAverage, profile.ratingCount);
  }

  private async summarizeWorker(
    workerId: string,
    ratingAverage: number | null,
    ratingCount: number,
  ): Promise<WorkerReviewsSummary> {
    const [trips, legacyProblems] = await Promise.all([
      this.bookingsService.listRatedJobsForWorker(workerId, RATED_JOBS_LIMIT),
      this.problemsService.listRatedJobsForWorker(workerId, RATED_JOBS_LIMIT),
    ]);
    return summarize([...trips, ...legacyProblems], ratingAverage, ratingCount);
  }
}

/** Newest-first reviews (customer shown by short name) plus a 1–5 star breakdown. */
function summarize(
  jobs: {
    rating: number | null;
    review: string | null;
    customerFullName: string;
    skillCategories: string[];
    completedAt: Date;
  }[],
  ratingAverage: number | null,
  ratingCount: number,
): WorkerReviewsSummary {
  const all: WorkerReview[] = jobs
    .map((job) => ({
      rating: job.rating,
      review: job.review,
      customerName: shortName(job.customerFullName),
      skillCategories: job.skillCategories,
      completedAt: job.completedAt,
    }))
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const distribution: WorkerReviewsSummary['distribution'] = [0, 0, 0, 0, 0];
  for (const review of all) {
    if (review.rating && review.rating >= 1 && review.rating <= 5) distribution[review.rating - 1] += 1;
  }
  return { ratingAverage, ratingCount, distribution, reviews: all.slice(0, REVIEWS_SHOWN) };
}
