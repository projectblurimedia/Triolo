import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobSeekerService, JobPost, SaveJobPostParams } from '@/services/jobSeekerService';
import { useAuthStore } from '@/state/authStore';

export const JOB_POST_QUERY_KEY = ['job-post', 'mine'];

export function useMyJobPost(enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({ queryKey: JOB_POST_QUERY_KEY, queryFn: jobSeekerService.getMine, enabled: enabled && !!accessToken });
}

export function useSaveJobPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: SaveJobPostParams) => jobSeekerService.save(params),
    onSuccess: (post) => queryClient.setQueryData<JobPost | null>(JOB_POST_QUERY_KEY, post),
  });
}

export function useSetJobPostActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) => jobSeekerService.setActive(isActive),
    onSuccess: (post) => queryClient.setQueryData<JobPost | null>(JOB_POST_QUERY_KEY, post),
  });
}

export function useDeleteJobPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => jobSeekerService.remove(),
    onSuccess: () => queryClient.setQueryData<JobPost | null>(JOB_POST_QUERY_KEY, null),
  });
}
