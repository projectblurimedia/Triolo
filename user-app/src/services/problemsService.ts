import { apiClient } from './apiClient';
import { PickedImage } from '@/components/ImagePickerField';

export interface ProblemPost {
  id: string;
  skillCategories: string[];
  description: string | null;
  quotationAmount: number;
  photoUrls: string[];
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  /** open → accepted (a worker took it) → work_done (worker says done) → completed (you confirmed). */
  status: ProblemStatus;
  acceptedAt: string | null;
  workDoneAt: string | null;
  completedAt: string | null;
  /** Your 1–5 star rating of the worker, given when you marked it finished. */
  workerRating: number | null;
  workerReview: string | null;
  createdAt: string;
  /** Set once a worker accepts — who took the job and how to reach them. */
  acceptedWorkerFullName: string | null;
  acceptedWorkerMobileNumber: string | null;
}

export type ProblemStatus = 'open' | 'closed' | 'accepted' | 'work_done' | 'completed';

export interface CreateProblemPostParams {
  skillCategories: string[];
  description?: string;
  quotationAmount: number;
  locationAddress: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateProblemPostParams extends CreateProblemPostParams {
  /** Which of the post's current photo URLs to keep; the rest are removed server-side. */
  keepPhotoUrls: string[];
}

export const problemsService = {
  create: (params: CreateProblemPostParams) => apiClient.post<ProblemPost>('/problems', params, true),

  update: (postId: string, params: UpdateProblemPostParams) =>
    apiClient.patch<ProblemPost>(`/problems/${postId}`, params, true),

  // One photo per request — Vercel rejects request bodies over 4.5MB, which several
  // camera photos in a single multipart body easily exceed.
  addPhoto: (postId: string, image: PickedImage) => {
    const formData = new FormData();
    // Same {uri,name,type} file-object shape workersService uses — what RN's FormData expects.
    formData.append('photo', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    return apiClient.postForm<ProblemPost>(`/problems/${postId}/photos`, formData);
  },

  complete: (postId: string, rating: number, review?: string) =>
    apiClient.post<ProblemPost>(`/problems/${postId}/complete`, { rating, review: review || undefined }, true),

  delete: (postId: string) => apiClient.delete<null>(`/problems/${postId}`, true),

  listMine: () => apiClient.get<ProblemPost[]>('/problems/mine', true),
};
