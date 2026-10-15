import { PreferredLanguage } from '@/modules/auth/interfaces';

/** open → accepted → work_done → completed. 'closed': an open post the admin took down. */
export type ProblemPostStatus = 'open' | 'closed' | 'accepted' | 'work_done' | 'completed';

export const MAX_PROBLEM_PHOTOS = 5;

export interface ProblemPost {
  id: string;
  accountId: string;
  skillCategories: string[];
  description: string | null;
  quotationAmount: number;
  photoUrls: string[];
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ProblemPostStatus;
  acceptedWorkerId: string | null;
  acceptedAt: Date | null;
  workDoneAt: Date | null;
  completedAt: Date | null;
  /** The customer's 1–5 star rating of the worker, given when confirming finished. */
  workerRating: number | null;
  workerReview: string | null;
  /**
   * The trip started when a worker accepted (map, live tracking, PIN, work done, rating —
   * the same flow as Quick Book). Null while open, and for jobs accepted before trips existed.
   */
  bookingRequestId: string | null;
  createdAt: Date;
}

/** A post as the admin sees it: who posted it, who took it, and why it was closed. */
export interface AdminProblemPost extends ProblemPost {
  customerFullName: string;
  customerMobileNumber: string;
  workerFullName: string | null;
  workerMobileNumber: string | null;
  closedReason: string | null;
  closedAt: Date | null;
}

export type AdminProblemGroup = 'open' | 'in_progress' | 'completed' | 'closed';

export interface AdminProblemListFilter {
  q?: string;
  group?: AdminProblemGroup;
  accountId?: string;
  page: number;
  limit: number;
}

/** A post plus its linked trip's live status (e.g. 'on_the_way'), for the job lists. */
export interface WithTripStatus {
  bookingStatus: string | null;
}

/** A finished job's rating/feedback, for the worker's public reviews. */
export interface RatedJob {
  rating: number | null;
  review: string | null;
  customerFullName: string;
  skillCategories: string[];
  completedAt: Date;
}

/** The customer's own view — once accepted, who took the job and how to reach them. */
export interface OwnProblemPost extends ProblemPost, WithTripStatus {
  acceptedWorkerFullName: string | null;
  acceptedWorkerMobileNumber: string | null;
}

/** What a worker sees before accepting — no customer identity, just the job and how far it is. */
export interface NearbyProblem {
  id: string;
  skillCategories: string[];
  description: string | null;
  quotationAmount: number;
  photoUrls: string[];
  locationAddress: string | null;
  distanceMeters: number;
  createdAt: Date;
}

/** A job this worker has accepted — now includes the customer's contact details. */
export interface AssignedProblem extends ProblemPost, WithTripStatus {
  customerFullName: string;
  customerMobileNumber: string;
}

/** Result of a status transition, with whoever needs to be notified about it. */
export interface ProblemTransitionResult {
  post: ProblemPost;
  notifyAccountId: string;
  notifyLanguage: PreferredLanguage;
}

export interface UpdateProblemPostParams {
  skillCategories: string[];
  description: string | null;
  quotationAmount: number;
  locationAddress: string;
  latitude: number | null;
  longitude: number | null;
  photoUrls: string[];
}

export interface CreateProblemPostParams {
  accountId: string;
  skillCategories: string[];
  description: string | null;
  quotationAmount: number;
  locationAddress: string;
  latitude: number | null;
  longitude: number | null;
}
