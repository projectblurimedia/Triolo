import { WorkerProfile } from '@/modules/workers/interfaces';
import { BusinessProfile } from '@/modules/businesses/interfaces';

export type FavoriteTargetType = 'worker' | 'business';
export const FAVORITE_TARGET_TYPES: FavoriteTargetType[] = ['worker', 'business'];

/** A saved worker, with the name the customer knows them by. */
export type FavoriteWorker = WorkerProfile & { accountFullName: string };

export interface FavoritesList {
  workers: FavoriteWorker[];
  businesses: BusinessProfile[];
}
