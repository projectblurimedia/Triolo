import { AppError } from '@/common/errors/AppError';
import { WorkersService } from '@/modules/workers/service';
import { BookingsService } from '@/modules/bookings/service';
import { ProblemsService } from '@/modules/problems/service';
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
  ) {}

  async getForWorker(workerId: string): Promise<WorkerReviewsSummary> {
    const profile = await this.workersService.getPublicProfile(workerId);
    if (!profile) {
      throw AppError.notFound('Worker not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    return this.summarize(workerId, profile.ratingAverage, profile.ratingCount);
  }

  async getForMe(accountId: string): Promise<WorkerReviewsSummary> {
    const profile = await this.workersService.getMyProfile(accountId);
    if (!profile) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    return this.summarize(profile.id, profile.ratingAverage, profile.ratingCount);
  }

  private async summarize(workerId: string, ratingAverage: number | null, ratingCount: number): Promise<WorkerReviewsSummary> {
    const [trips, legacyProblems] = await Promise.all([
      this.bookingsService.listRatedJobsForWorker(workerId, RATED_JOBS_LIMIT),
      this.problemsService.listRatedJobsForWorker(workerId, RATED_JOBS_LIMIT),
    ]);
    const all: WorkerReview[] = [...trips, ...legacyProblems]
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
}
