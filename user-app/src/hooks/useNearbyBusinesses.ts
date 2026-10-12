import { useQuery } from '@tanstack/react-query';
import { businessesService } from '@/services/businessesService';
import { SERVICES_RADIUS_KM } from './useNearbyWorkers';

/** Verified shops near the device — Home's marketplace row. Same testing radius as workers. */
export function useNearbyBusinesses(latitude: number | null, longitude: number | null, limit = 20) {
  return useQuery({
    queryKey: ['businesses', 'nearby', latitude, longitude, limit],
    queryFn: () =>
      businessesService.searchNearby({
        latitude: latitude as number,
        longitude: longitude as number,
        radiusKm: SERVICES_RADIUS_KM,
        limit,
      }),
    enabled: latitude != null && longitude != null,
    staleTime: 60_000,
  });
}
