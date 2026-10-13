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
