import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { problemsService } from '@/services/problemsService';

export const MY_PROBLEMS_QUERY_KEY = ['problems', 'mine'];
// While the list is open, poll so a worker accepting / marking done shows up without a
// manual refresh (the push notification covers the app-closed case).
const POLL_INTERVAL_MS = 15000;

export function useMyProblems(enabled = true) {
  return useQuery({
    queryKey: MY_PROBLEMS_QUERY_KEY,
    queryFn: problemsService.listMine,
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
  });
}

export function useDeleteProblem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => problemsService.delete(postId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: MY_PROBLEMS_QUERY_KEY }),
  });
}

export function useCompleteProblem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, rating, review }: { postId: string; rating: number; review?: string }) =>
      problemsService.complete(postId, rating, review),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MY_PROBLEMS_QUERY_KEY });
      // The worker's average just changed — refresh the Services tab's lists too.
      queryClient.invalidateQueries({ queryKey: ['workers', 'nearby'] });
    },
  });
}
