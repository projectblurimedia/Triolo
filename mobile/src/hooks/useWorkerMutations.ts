import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workersService, CreateWorkerProfileParams } from '@/services/workersService';

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
