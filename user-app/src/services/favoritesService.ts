import { apiClient } from './apiClient';
import { WorkerProfile } from './workersService';
import { BusinessProfile } from './businessesService';

export type FavoriteType = 'worker' | 'business';

export interface FavoritesList {
  workers: (WorkerProfile & { accountFullName: string })[];
  businesses: BusinessProfile[];
}

export const favoritesService = {
  list: () => apiClient.get<FavoritesList>('/favorites', true),
  add: (type: FavoriteType, id: string) => apiClient.put<null>(`/favorites/${type}/${id}`, undefined, true),
  remove: (type: FavoriteType, id: string) => apiClient.delete<null>(`/favorites/${type}/${id}`, true),
};
