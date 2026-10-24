import { useQuery } from '@tanstack/react-query';
import { subscriptionsService } from '@/services/subscriptionsService';
import { useAuthStore } from '@/state/authStore';

export const SUBSCRIPTION_QUERY_KEY = ['subscription', 'partner'] as const;
export const BADGES_QUERY_KEY = ['subscription', 'badges'] as const;
export const BOOSTS_QUERY_KEY = ['boosts'] as const;

export function useMySubscription() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: subscriptionsService.getMine,
    enabled: !!accessToken,
    staleTime: 60_000,
  });
}

export function useMyBadges() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({ queryKey: BADGES_QUERY_KEY, queryFn: subscriptionsService.getMyBadges, enabled: !!accessToken });
}

export function useBoostInfo(enabled: boolean) {
  return useQuery({ queryKey: ['boosts', 'info'], queryFn: subscriptionsService.boostInfo, enabled, staleTime: 5 * 60_000 });
}

export function useMyBoosts(enabled: boolean) {
  return useQuery({ queryKey: BOOSTS_QUERY_KEY, queryFn: subscriptionsService.myBoosts, enabled });
}

/** Which of my profiles (service / business / job_post) have an active Trusted by Triolo badge. */
export function useTrustedKinds(): Set<string> {
  const { data } = useMyBadges();
  return new Set((data?.profiles ?? []).filter((entry) => entry.status === 'active').map((entry) => entry.kind));
}
