import { useQuery } from '@tanstack/react-query';
import { bookingOffersService } from '@/services/bookingOffersService';
import { shopOrdersService } from '@/services/shopOrdersService';
import { useAuthStore } from '@/state/authStore';

export const QUICK_LIMIT_QUERY_KEY = ['quick-limit'];

/** This month's free Quick Book (service) / Quick Order (shop) accepts without a plan. */
export interface QuickAcceptStatus {
  /** null = no limit (plans off, on that side's plan, or none set). */
  limit: number | null;
  used: number;
  remaining: number | null;
}

/** From this many left, accepting asks first and the card says how many are left. */
export const FEW_ACCEPTS_LEFT = 3;

export function useQuickAcceptLimit(side: 'service' | 'shop', enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: [...QUICK_LIMIT_QUERY_KEY, side],
    queryFn: (): Promise<QuickAcceptStatus> => (side === 'service' ? bookingOffersService.quickLimit() : shopOrdersService.quickLimit()),
    enabled: enabled && !!accessToken,
    staleTime: 30 * 1000,
    retry: false,
  });
}
