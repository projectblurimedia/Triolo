import { useQuery } from '@tanstack/react-query';
import { NearbyWorkerSort, workersService } from '@/services/workersService';

// Wide on purpose for testing — matches Quick Book / problem matching (50km is also the
// backend's max). A production default would be much smaller.
export const SERVICES_RADIUS_KM = 50;
const MAX_RESULTS = 50;

interface NearbyWorkersParams {
  latitude: number | null;
  longitude: number | null;
  /** null = every category. */
  skillCategory: string | null;
  sort: NearbyWorkerSort;
}

/** Verified workers near the device for the Services tab, optionally one category, nearest or top rated first. */
export function useNearbyWorkers({ latitude, longitude, skillCategory, sort }: NearbyWorkersParams) {
  return useQuery({
    queryKey: ['workers', 'nearby', latitude, longitude, skillCategory, sort],
    queryFn: () =>
      workersService.searchNearby({
        latitude: latitude as number,
        longitude: longitude as number,
        radiusKm: SERVICES_RADIUS_KM,
        skillCategory: skillCategory ?? undefined,
        sort,
        limit: MAX_RESULTS,
      }),
    enabled: latitude != null && longitude != null,
    staleTime: 60_000,
  });
}
