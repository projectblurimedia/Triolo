import { PreferredLanguage } from '@/modules/auth/interfaces';

/** open → accepted → work_done → completed. 'closed' exists in the DB enum but is unused. */
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
  createdAt: Date;
}

/** The customer's own view — once accepted, who took the job and how to reach them. */
export interface OwnProblemPost extends ProblemPost {
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
export interface AssignedProblem extends ProblemPost {
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
