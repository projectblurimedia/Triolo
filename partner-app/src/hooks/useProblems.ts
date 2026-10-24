import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocationGatedMutation } from './useLocationGatedMutation';
import { problemsService } from '@/services/problemsService';
import { MY_JOBS_QUERY_KEY } from './useJobs';

export const NEARBY_PROBLEMS_QUERY_KEY = ['problems', 'nearby'];
export const ASSIGNED_PROBLEMS_QUERY_KEY = ['problems', 'assigned'];
// Problems aren't urgent like Quick Book offers (no push to workers for new posts yet), so a
// slower poll than useBookingOffers()'s 8s keeps Home fresh without hammering the backend.
const POLL_INTERVAL_MS = 15000;

export function useNearbyProblems(enabled: boolean) {
  return useQuery({
    queryKey: NEARBY_PROBLEMS_QUERY_KEY,
    queryFn: problemsService.listNearby,
    refetchInterval: POLL_INTERVAL_MS,
    enabled,
  });
}

export function useAssignedProblems(enabled: boolean) {
  return useQuery({
    queryKey: ASSIGNED_PROBLEMS_QUERY_KEY,
    queryFn: problemsService.listAssigned,
    refetchInterval: POLL_INTERVAL_MS,
    enabled,
  });
}

function useInvalidateProblems() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: NEARBY_PROBLEMS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ASSIGNED_PROBLEMS_QUERY_KEY }),
      // An accepted problem is also a job now (it runs as a trip).
      queryClient.invalidateQueries({ queryKey: MY_JOBS_QUERY_KEY }),
    ]);
}

export function useAcceptProblem() {
  const invalidate = useInvalidateProblems();
  return useLocationGatedMutation({
    mutationFn: (problemId: string) => problemsService.accept(problemId),
    // No partner plan: one paid accept.
    payKind: 'accept',
    // Settled, not success — a lost race (409) also means the list is stale.
    onSettled: invalidate,
  });
}

export function useMarkWorkDone() {
  const invalidate = useInvalidateProblems();
  return useLocationGatedMutation({
    mutationFn: (problemId: string) => problemsService.markWorkDone(problemId),
    onSettled: invalidate,
  });
}
