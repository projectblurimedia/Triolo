import { useQuery } from '@tanstack/react-query';
import { businessesService } from '@/services/businessesService';
import { SERVICES_RADIUS_KM } from './useNearbyWorkers';

/**
 * Verified shops near the device — Home's marketplace row. Same testing radius as workers, and
 * the same 50-shop cap as the Bazaar tab, so "N shops near you" agrees on both.
 */
export function useNearbyBusinesses(latitude: number | null, longitude: number | null, limit = 50) {
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
