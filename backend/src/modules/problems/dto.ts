export interface CreateProblemPostDto {
  skillCategories: string[];
  description?: string;
  quotationAmount: number;
  locationAddress: string;
  latitude?: number;
  longitude?: number;
}

export interface CompleteProblemDto {
  rating?: number;
  review?: string;
}

export interface UpdateProblemPostDto extends CreateProblemPostDto {
  /** Which of the post's current photos to keep — any current photo not listed is removed. */
  keepPhotoUrls: string[];
}
