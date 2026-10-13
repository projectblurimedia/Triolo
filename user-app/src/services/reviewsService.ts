import { apiClient } from './apiClient';

export interface WorkerReview {
  rating: number | null;
  review: string | null;
  /** First name and last initial only, e.g. "Ravi K.". */
  customerName: string;
  skillCategories: string[];
  completedAt: string;
}

export interface WorkerReviewsSummary {
  ratingAverage: number | null;
  ratingCount: number;
  /** Ratings per star value — index 0 is 1 star, index 4 is 5 stars. */
  distribution: [number, number, number, number, number];
  /** Newest first. */
  reviews: WorkerReview[];
}

export const reviewsService = {
  /** A worker's public ratings and feedback (as a customer sees them). */
  getForWorker: (workerId: string) => apiClient.get<WorkerReviewsSummary>(`/reviews/workers/${workerId}`, true),
  /** The signed-in worker's own ratings and feedback. */
  getMine: () => apiClient.get<WorkerReviewsSummary>('/reviews/me', true),
};
