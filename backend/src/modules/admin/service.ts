import { WorkersService } from '@/modules/workers/service';
import { BusinessesService } from '@/modules/businesses/service';
import { AdminListFilter as WorkerAdminListFilter } from '@/modules/workers/interfaces';
import { AdminListFilter as BusinessAdminListFilter } from '@/modules/businesses/interfaces';
import { ListQueryDto } from './dto';
import { VerificationDecision } from './interfaces';

/**
 * Every method here is a thin delegation to `WorkersService`/`BusinessesService`'s own
 * admin-facing methods — this module never queries `worker_profiles`/`business_profiles`
 * directly, respecting the "communicate only through service interfaces" module-boundary
 * rule (see .cloud/architecture.md). Its own unit tests verify the delegation itself; the
 * substantive list-filter/verification-status behavior is tested where it actually lives,
 * in workers/service.test.ts and businesses/service.test.ts.
 */
export class AdminService {
  constructor(
    private readonly workersService: WorkersService,
    private readonly businessesService: BusinessesService,
  ) {}

  listWorkers(query: ListQueryDto) {
    const filter: WorkerAdminListFilter = { status: query.status, page: query.page, limit: query.limit };
    return this.workersService.adminListProfiles(filter);
  }

  getWorker(id: string) {
    return this.workersService.adminGetProfile(id);
  }

  setWorkerVerification(id: string, status: VerificationDecision) {
    return this.workersService.adminSetVerificationStatus(id, status);
  }

  listBusinesses(query: ListQueryDto) {
    const filter: BusinessAdminListFilter = { status: query.status, page: query.page, limit: query.limit };
    return this.businessesService.adminListProfiles(filter);
  }

  getBusiness(id: string) {
    return this.businessesService.adminGetProfile(id);
  }

  setBusinessVerification(id: string, status: VerificationDecision) {
    return this.businessesService.adminSetVerificationStatus(id, status);
  }
}
