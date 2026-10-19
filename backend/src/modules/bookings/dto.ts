export interface CancelBookingDto {
  /** Only for a late worker (see LATE_AFTER_MINUTES). */
  rating?: number;
  review?: string;
}

export interface CreateDirectBookingDto {
  workerId: string;
  skillCategories: string[];
  latitude: number;
  longitude: number;
  locationAddress?: string;
}

export interface CreateQuickBookingDto {
  skillCategories: string[];
  latitude: number;
  longitude: number;
  radiusKm: number;
  locationAddress?: string;
}

export interface UpdateWorkerLocationDto {
  latitude: number;
  longitude: number;
}

export interface VerifyPinDto {
  pin: string;
}

export interface CompleteBookingDto {
  rating?: number;
  review?: string;
}
