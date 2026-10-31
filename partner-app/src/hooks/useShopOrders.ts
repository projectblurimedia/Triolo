import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocationGatedMutation } from './useLocationGatedMutation';
import { ACTIVE_SHOP_STATUSES, NEW_ORDER_STATUSES, ShopOrder, shopOrdersService } from '@/services/shopOrdersService';
import { useAuthStore } from '@/state/authStore';
import { completeAccept, GivenBackError } from '@/utils/afterAccept';

export const SHOP_ORDERS_QUERY_KEY = ['shop-orders', 'mine'];
export const shopOrderQueryKey = (id: string | null) => ['shop-orders', 'detail', id];

// New lists should feel close to instant for the shop; a running order a little less so.
// New orders should show up within seconds, even without a push.
const LIST_POLL_MS = 6000;
const ACTIVE_POLL_MS = 8000;

export function useShopOrders(enabled: boolean) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: SHOP_ORDERS_QUERY_KEY,
    queryFn: shopOrdersService.listMine,
    enabled: enabled && !!accessToken,
    refetchInterval: enabled ? LIST_POLL_MS : false,
  });
}

export function useShopOrder(id: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: shopOrderQueryKey(id),
    queryFn: () => shopOrdersService.get(id as string),
    enabled: id !== null,
    // Opened from a list: show what the list already has at once, while the fresh copy loads.
    placeholderData: () => (id ? queryClient.getQueryData<ShopOrder[]>(SHOP_ORDERS_QUERY_KEY)?.find((order) => order.id === id) : undefined),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return !status || NEW_ORDER_STATUSES.includes(status) || ACTIVE_SHOP_STATUSES.includes(status) ? ACTIVE_POLL_MS : false;
    },
  });
}

/** Any shop step (accept, save items, packed, ready, verify PIN, cancel) — refreshes the order and list after. */
export function useShopOrderAction<TArgs extends { id: string }, TResult = unknown>(
  action: (args: TArgs) => Promise<TResult>,
  // 'accept': after accepting, the ad or the fee (without a plan) — see completeAccept.
  step?: 'accept',
) {
  const queryClient = useQueryClient();
  // Location must be on for every partner action, shop orders included (asked for first).
  return useLocationGatedMutation({
    mutationFn: async (args: TArgs) => {
      const result = await action(args);
      if (step === 'accept' && !(await completeAccept('order', args.id, 'order_accept'))) throw new GivenBackError();
      return result;
    },
    onSettled: (_data, _error, args) => {
      const refresh = Promise.all([
        queryClient.invalidateQueries({ queryKey: shopOrderQueryKey(args.id) }),
        queryClient.invalidateQueries({ queryKey: SHOP_ORDERS_QUERY_KEY }),
      ]);
      // After accepting, the order opens at once (it's already loaded); the lists refresh behind it.
      return step === 'accept' ? undefined : refresh;
    },
  });
}

