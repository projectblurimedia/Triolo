import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocationGatedMutation } from './useLocationGatedMutation';
import { ACTIVE_SHOP_STATUSES, NEW_ORDER_STATUSES, shopOrdersService } from '@/services/shopOrdersService';
import { useAuthStore } from '@/state/authStore';
import { PassKind } from '@/services/subscriptionsService';

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
  return useQuery({
    queryKey: shopOrderQueryKey(id),
    queryFn: () => shopOrdersService.get(id as string),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return !status || NEW_ORDER_STATUSES.includes(status) || ACTIVE_SHOP_STATUSES.includes(status) ? ACTIVE_POLL_MS : false;
    },
  });
}

/** Any shop step (accept, save items, packed, ready, verify PIN, cancel) — refreshes the order and list after. */
export function useShopOrderAction<TArgs extends { id: string }, TResult = unknown>(
  action: (args: TArgs) => Promise<TResult>,
  // Accepting an order without a partner plan is paid for once.
  payKind?: PassKind,
) {
  const queryClient = useQueryClient();
  // Location must be on for every partner action, shop orders included (asked for first).
  return useLocationGatedMutation({
    mutationFn: (args: TArgs) => action(args),
    payKind,
    payPlan: 'shop',
    onSettled: (_data, _error, args) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: shopOrderQueryKey(args.id) }),
        queryClient.invalidateQueries({ queryKey: SHOP_ORDERS_QUERY_KEY }),
      ]),
  });
}
