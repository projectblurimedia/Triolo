/** One customer's rating/feedback on a finished job, as shown on a worker's profile. */
export interface WorkerReview {
  rating: number | null;
  review: string | null;
  /** First name and last initial only (e.g. "Ravi K.") — never the full name or contact. */
  customerName: string;
  skillCategories: string[];
  completedAt: Date;
}

export interface WorkerReviewsSummary {
  ratingAverage: number | null;
  ratingCount: number;
  /** How many ratings of each star value — index 0 is 1 star, index 4 is 5 stars. */
  distribution: [number, number, number, number, number];
  /** Newest first. */
  reviews: WorkerReview[];
}
