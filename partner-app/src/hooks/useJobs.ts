import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTIVE_JOB_STATUSES, jobsService } from '@/services/jobsService';
import { useAuthStore } from '@/state/authStore';

export const MY_JOBS_QUERY_KEY = ['jobs', 'mine'];
export const jobQueryKey = (id: string | null) => ['jobs', 'detail', id];

const ACTIVE_POLL_MS = 6000;
const LIST_POLL_MS = 12000;

/** One job — refreshed while active, so a customer cancel or finish shows up promptly. */
export function useJob(id: string | null) {
  return useQuery({
    queryKey: jobQueryKey(id),
    queryFn: () => jobsService.get(id as string),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return !status || ACTIVE_JOB_STATUSES.includes(status) ? ACTIVE_POLL_MS : false;
    },
  });
}

/** Every Quick Book job this worker accepted — active first, then history. */
export function useMyJobs() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: MY_JOBS_QUERY_KEY,
    queryFn: jobsService.listMine,
    enabled: !!accessToken,
    refetchInterval: LIST_POLL_MS,
  });
}

/** A trip step (start / arrive / verify PIN / work done) that refreshes the job afterwards. */
export function useJobAction<TArgs extends { id: string }>(action: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSettled: (_data, _error, args) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: jobQueryKey(args.id) }),
        queryClient.invalidateQueries({ queryKey: MY_JOBS_QUERY_KEY }),
      ]),
  });
}
