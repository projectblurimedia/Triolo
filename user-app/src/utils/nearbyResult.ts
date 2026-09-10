import { WorkerNearbyResult } from '@/services/workersService';
import { BusinessNearbyResult } from '@/services/businessesService';

export type NearbySearchMode = 'worker' | 'business';

export type NearbyResult = WorkerNearbyResult | BusinessNearbyResult;

/** "420m" for under a km, "1.3km" otherwise — matches the "500m away"/"1km far" phrasing from the feature request. */
export function formatDistanceValue(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function isWorkerResult(mode: NearbySearchMode, item: NearbyResult): item is WorkerNearbyResult {
  return mode === 'worker';
}
