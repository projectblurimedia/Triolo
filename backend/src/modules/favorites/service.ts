import { WorkersService } from '@/modules/workers/service';
import { BusinessesService } from '@/modules/businesses/service';
import { FavoritesRepository } from './repository';
import { FavoritesList, FavoriteTargetType } from './interfaces';

/**
 * A customer's saved workers and shops (the Services/Bazaar menus' Favorites). Owns only the
 * `favorites` table; the profiles themselves come through WorkersService/BusinessesService,
 * and only still-verified ones are returned, newest saved first.
 */
export class FavoritesService {
  constructor(
    private readonly repository: FavoritesRepository,
    private readonly workersService: WorkersService,
    private readonly businessesService: BusinessesService,
  ) {}

  async add(accountId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
    await this.repository.add(accountId, targetType, targetId);
  }

  async remove(accountId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
    await this.repository.remove(accountId, targetType, targetId);
  }

  async list(accountId: string): Promise<FavoritesList> {
    const [workerIds, businessIds] = await Promise.all([
      this.repository.listIds(accountId, 'worker'),
      this.repository.listIds(accountId, 'business'),
    ]);
    const [workers, businesses] = await Promise.all([
      this.workersService.getVerifiedProfiles(workerIds),
      this.businessesService.getVerifiedProfiles(businessIds),
    ]);
    const byOrder = <T extends { id: string }>(ids: string[], rows: T[]) =>
      ids.map((id) => rows.find((row) => row.id === id)).filter((row): row is T => !!row);
    return { workers: byOrder(workerIds, workers), businesses: byOrder(businessIds, businesses) };
  }
}
