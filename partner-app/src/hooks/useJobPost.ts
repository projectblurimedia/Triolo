import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobSeekerService, JobPost, SaveJobPostParams } from '@/services/jobSeekerService';
import { useAuthStore } from '@/state/authStore';

/** All the partner's job posts (a partner may keep several — e.g. tutor and cook). */
export const JOB_POST_QUERY_KEY = ['job-posts', 'mine'];

export function useMyJobPosts(enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({ queryKey: JOB_POST_QUERY_KEY, queryFn: jobSeekerService.listMine, enabled: enabled && !!accessToken });
}

/** The partner's first job post (whether they have one at all), or null. */
export function useMyJobPost(enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: JOB_POST_QUERY_KEY,
    queryFn: jobSeekerService.listMine,
    enabled: enabled && !!accessToken,
    select: (posts: JobPost[]) => posts[0] ?? null,
  });
}

/** Puts a saved post into the cached list (replacing it, or adding a new one at the end). */
export function upsertCachedPost(posts: JobPost[] | undefined, post: JobPost): JobPost[] {
  const list = posts ?? [];
  return list.some((entry) => entry.id === post.id) ? list.map((entry) => (entry.id === post.id ? post : entry)) : [...list, post];
}

/** Creates a post (no `id`) or edits one. */
export function useSaveJobPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id?: string; params: SaveJobPostParams }) =>
      id ? jobSeekerService.update(id, params) : jobSeekerService.create(params),
    onSuccess: (post) => queryClient.setQueryData<JobPost[]>(JOB_POST_QUERY_KEY, (posts) => upsertCachedPost(posts, post)),
  });
}

export function useSetJobPostActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => jobSeekerService.setActive(id, isActive),
    onSuccess: (post) => queryClient.setQueryData<JobPost[]>(JOB_POST_QUERY_KEY, (posts) => upsertCachedPost(posts, post)),
  });
}

export function useDeleteJobPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jobSeekerService.remove(id),
    onSuccess: (_, id) => queryClient.setQueryData<JobPost[]>(JOB_POST_QUERY_KEY, (posts) => (posts ?? []).filter((post) => post.id !== id)),
  });
}
