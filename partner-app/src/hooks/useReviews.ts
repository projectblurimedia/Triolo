import { useQuery } from '@tanstack/react-query';
import { reviewsService } from '@/services/reviewsService';

// New ratings only arrive when a job finishes — no need to poll.
const STALE_MS = 60_000;

export function useWorkerReviews(workerId: string | null) {
  return useQuery({
    queryKey: ['reviews', 'worker', workerId],
    queryFn: () => reviewsService.getForWorker(workerId as string),
    enabled: workerId !== null,
    staleTime: STALE_MS,
  });
}

export function useMyReviews(enabled: boolean) {
  return useQuery({
    queryKey: ['reviews', 'me'],
    queryFn: reviewsService.getMine,
    enabled,
    staleTime: STALE_MS,
  });
}
