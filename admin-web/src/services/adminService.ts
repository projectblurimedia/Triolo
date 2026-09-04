import { apiClient } from './apiClient';
import { WorkerProfileWithAccount } from './workersService';
import { BusinessProfileWithAccount } from './businessesService';

export interface AdminListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type VerificationStatusFilter = 'pending_verification' | 'verified' | 'rejected';
export type VerificationDecision = 'verified' | 'rejected';

function listQuery(status?: VerificationStatusFilter, page = 1, limit = 20) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return params.toString();
}

export const adminService = {
  listWorkers: (status?: VerificationStatusFilter, page = 1, limit = 20) =>
    apiClient.get<AdminListResult<WorkerProfileWithAccount>>(`/admin/workers?${listQuery(status, page, limit)}`, true),

  getWorker: (id: string) => apiClient.get<WorkerProfileWithAccount>(`/admin/workers/${id}`, true),

  setWorkerVerification: (id: string, status: VerificationDecision) =>
    apiClient.patch<WorkerProfileWithAccount>(`/admin/workers/${id}/verification`, { status }, true),

  listBusinesses: (status?: VerificationStatusFilter, page = 1, limit = 20) =>
    apiClient.get<AdminListResult<BusinessProfileWithAccount>>(
      `/admin/businesses?${listQuery(status, page, limit)}`,
      true,
    ),

  getBusiness: (id: string) => apiClient.get<BusinessProfileWithAccount>(`/admin/businesses/${id}`, true),

  setBusinessVerification: (id: string, status: VerificationDecision) =>
    apiClient.patch<BusinessProfileWithAccount>(`/admin/businesses/${id}/verification`, { status }, true),
};
