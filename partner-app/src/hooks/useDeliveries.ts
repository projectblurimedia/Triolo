import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveriesService } from '@/services/deliveriesService';
import { useAuthStore } from '@/state/authStore';
import { requireLocation } from '@/utils/requireLocation';

export const DELIVERIES_QUERY_KEY = ['orders', 'staff', 'deliveries'];

/** Deliveries handed to this account (as a shop's delivery staff). */
export function useMyDeliveries(enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: DELIVERIES_QUERY_KEY,
    queryFn: deliveriesService.listMine,
    enabled: enabled && !!accessToken,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function useVerifyDeliveryPin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: string }) => {
      // Location on, like every other partner step.
      await requireLocation();
      return deliveriesService.verifyPin(id, pin);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
  });
}

/** Take (or turn down) a delivery a shop handed me. */
export function useAnswerDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (accept) await requireLocation();
      return deliveriesService.answer(id, accept);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
  });
}
