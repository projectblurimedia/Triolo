import { apiClient } from './apiClient';

export type ProblemStatus = 'open' | 'closed' | 'accepted' | 'work_done' | 'completed';

/** An open problem near this worker — no customer identity until accepted. */
export interface NearbyProblem {
  id: string;
  skillCategories: string[];
  description: string | null;
  quotationAmount: number;
  photoUrls: string[];
  locationAddress: string | null;
  distanceMeters: number;
  createdAt: string;
}

/** A job this worker accepted — includes the customer's contact details. */
export interface AssignedProblem {
  id: string;
  skillCategories: string[];
  description: string | null;
  quotationAmount: number;
  photoUrls: string[];
  locationAddress: string | null;
  status: ProblemStatus;
  acceptedAt: string | null;
  workDoneAt: string | null;
  completedAt: string | null;
  createdAt: string;
  customerFullName: string;
  customerMobileNumber: string;
}

export const problemsService = {
  listNearby: () => apiClient.get<NearbyProblem[]>('/problems/nearby', true),
  listAssigned: () => apiClient.get<AssignedProblem[]>('/problems/assigned', true),
  accept: (problemId: string) => apiClient.post<AssignedProblem>(`/problems/${problemId}/accept`, undefined, true),
  markWorkDone: (problemId: string) => apiClient.post<AssignedProblem>(`/problems/${problemId}/work-done`, undefined, true),
};
