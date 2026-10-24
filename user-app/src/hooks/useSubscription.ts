import { useQuery } from '@tanstack/react-query';
import { subscriptionsService } from '@/services/subscriptionsService';
import { useAuthStore } from '@/state/authStore';

export const SUBSCRIPTION_QUERY_KEY = ['subscription', 'customer'] as const;
export const TRUSTED_QUERY_KEY = ['subscription', 'trusted'] as const;

export function useMySubscription() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: subscriptionsService.getMine,
    enabled: !!accessToken,
    staleTime: 60_000,
  });
}

/**
 * What booking / ordering costs this person right now: the admin's pay-once fee when plans are
 * on and they have no plan and no paid pass left, else null (free). Shown on final buttons;
 * payIfNeeded() takes the payment.
 */
export function usePayHint(kind: 'book' | 'order'): number | null {
  const { data } = useMySubscription();
  if (!data?.enabled || data.active) return null;
  if ((data.passes?.[kind] ?? 0) > 0) return null;
  const fee = data.fees?.[kind] ?? 0;
  return fee > 0 ? fee : null;
}

/** "Book Nearby · ₹10" when there's something to pay. */
export const withFee = (label: string, fee: number | null) => (fee ? `${label} · ₹${fee}` : label);

/** Profiles marked "Trusted by Triolo". */
export function useTrustedIds() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: TRUSTED_QUERY_KEY,
    queryFn: subscriptionsService.trusted,
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
  });
}

export function useIsTrusted(kind: 'service' | 'business' | 'job_post', id: string | null | undefined) {
  const { data } = useTrustedIds();
  return !!id && !!data?.[kind]?.includes(id);
}
