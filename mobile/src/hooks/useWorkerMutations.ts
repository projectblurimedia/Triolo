import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workersService, CreateWorkerProfileParams, UpdateWorkerProfileParams } from '@/services/workersService';

export const WORKER_PROFILE_QUERY_KEY = ['workers', 'me', 'profile'];

export function useMyWorkerProfile() {
  return useQuery({ queryKey: WORKER_PROFILE_QUERY_KEY, queryFn: workersService.getMyProfile });
}

export function useCreateWorkerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateWorkerProfileParams) => workersService.createProfile(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKER_PROFILE_QUERY_KEY }),
  });
}

export function useUpdateWorkerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: UpdateWorkerProfileParams) => workersService.updateProfile(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKER_PROFILE_QUERY_KEY }),
  });
}

export function useDeleteWorkerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => workersService.deleteProfile(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKER_PROFILE_QUERY_KEY }),
  });
}
