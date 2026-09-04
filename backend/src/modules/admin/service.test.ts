import { AdminService } from './service';
import { WorkersService } from '@/modules/workers/service';
import { BusinessesService } from '@/modules/businesses/service';

function createMockWorkersService() {
  return {
    adminListProfiles: jest.fn(),
    adminGetProfile: jest.fn(),
    adminSetVerificationStatus: jest.fn(),
  } as unknown as jest.Mocked<WorkersService>;
}

function createMockBusinessesService() {
  return {
    adminListProfiles: jest.fn(),
    adminGetProfile: jest.fn(),
    adminSetVerificationStatus: jest.fn(),
  } as unknown as jest.Mocked<BusinessesService>;
}

// AdminService is a thin delegation layer (see its own doc comment for why — the
// module-boundary rule means it only ever calls WorkersService/BusinessesService, never a
// repository directly) — these tests verify exactly that delegation, not business logic
// that's already covered in workers/service.test.ts and businesses/service.test.ts.
describe('AdminService', () => {
  it('listWorkers delegates to WorkersService.adminListProfiles with the query as the filter', async () => {
    const workers = createMockWorkersService();
    const businesses = createMockBusinessesService();
    const result = { items: [], total: 0, page: 2, limit: 10 };
    workers.adminListProfiles.mockResolvedValue(result);
    const service = new AdminService(workers, businesses);

    await expect(service.listWorkers({ status: 'verified', page: 2, limit: 10 })).resolves.toBe(result);
    expect(workers.adminListProfiles).toHaveBeenCalledWith({ status: 'verified', page: 2, limit: 10 });
  });

  it('getWorker delegates to WorkersService.adminGetProfile', async () => {
    const workers = createMockWorkersService();
    const businesses = createMockBusinessesService();
    const profile = { id: 'worker-1' };
    workers.adminGetProfile.mockResolvedValue(profile as never);
    const service = new AdminService(workers, businesses);

    await expect(service.getWorker('worker-1')).resolves.toBe(profile);
    expect(workers.adminGetProfile).toHaveBeenCalledWith('worker-1');
  });

  it('setWorkerVerification delegates to WorkersService.adminSetVerificationStatus', async () => {
    const workers = createMockWorkersService();
    const businesses = createMockBusinessesService();
    const service = new AdminService(workers, businesses);

    await service.setWorkerVerification('worker-1', 'verified');
    expect(workers.adminSetVerificationStatus).toHaveBeenCalledWith('worker-1', 'verified');
  });

  it('listBusinesses delegates to BusinessesService.adminListProfiles with the query as the filter', async () => {
    const workers = createMockWorkersService();
    const businesses = createMockBusinessesService();
    const result = { items: [], total: 0, page: 1, limit: 20 };
    businesses.adminListProfiles.mockResolvedValue(result);
    const service = new AdminService(workers, businesses);

    await expect(service.listBusinesses({ page: 1, limit: 20 })).resolves.toBe(result);
    expect(businesses.adminListProfiles).toHaveBeenCalledWith({ status: undefined, page: 1, limit: 20 });
  });

  it('getBusiness delegates to BusinessesService.adminGetProfile', async () => {
    const workers = createMockWorkersService();
    const businesses = createMockBusinessesService();
    const profile = { id: 'business-1' };
    businesses.adminGetProfile.mockResolvedValue(profile as never);
    const service = new AdminService(workers, businesses);

    await expect(service.getBusiness('business-1')).resolves.toBe(profile);
    expect(businesses.adminGetProfile).toHaveBeenCalledWith('business-1');
  });

  it('setBusinessVerification delegates to BusinessesService.adminSetVerificationStatus', async () => {
    const workers = createMockWorkersService();
    const businesses = createMockBusinessesService();
    const service = new AdminService(workers, businesses);

    await service.setBusinessVerification('business-1', 'rejected');
    expect(businesses.adminSetVerificationStatus).toHaveBeenCalledWith('business-1', 'rejected');
  });
});
