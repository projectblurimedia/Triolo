import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTIVE_ORDER_STATUSES, CreateOrderParams, CustomerOrder, ordersService } from '@/services/ordersService';
import { useAuthStore } from '@/state/authStore';

export const MY_ORDERS_QUERY_KEY = ['orders', 'mine'];
export const orderQueryKey = (id: string | null) => ['orders', 'detail', id];

// The shop works through the order step by step; a short poll keeps the customer's screen live.
const ACTIVE_POLL_MS = 5000;
const LIST_POLL_MS = 15000;

/**
 * One order for its tracking screen. It opens on whichever copy is newer — its own, or the one
 * in My Orders / Continue (polled anyway) — so the header shows the right step at once.
 */
export function useOrder(id: string | null) {
  const list = useQuery({ queryKey: MY_ORDERS_QUERY_KEY, queryFn: ordersService.listMine, enabled: false });
  const query = useQuery({
    queryKey: orderQueryKey(id),
    queryFn: () => ordersService.get(id as string),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return !status || ACTIVE_ORDER_STATUSES.includes(status) ? ACTIVE_POLL_MS : false;
    },
  });
  const fromList = id ? list.data?.find((order) => order.id === id) : undefined;
  const useList = !!fromList && list.dataUpdatedAt > query.dataUpdatedAt;
  const data = useList ? fromList : query.data;
  return { ...query, data, isLoading: query.isLoading && !data };
}

export function useMyOrders(enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: MY_ORDERS_QUERY_KEY,
    queryFn: ordersService.listMine,
    enabled: enabled && !!accessToken,
    refetchInterval: enabled ? LIST_POLL_MS : false,
  });
}

function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return (id?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: MY_ORDERS_QUERY_KEY }),
      id ? queryClient.invalidateQueries({ queryKey: orderQueryKey(id) }) : Promise.resolve(),
    ]);
}

export function useCreateOrder() {
  const invalidate = useInvalidateOrders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateOrderParams) => ordersService.create(params),
    onSuccess: (order) => {
      // The tracker opens straight onto the new order — no loading flash.
      queryClient.setQueryData(orderQueryKey(order.id), order);
      // In My Orders, Continue and the Bazaar tab count at once, not at the next refresh.
      queryClient.setQueryData<CustomerOrder[]>(MY_ORDERS_QUERY_KEY, (list) => [order, ...(list ?? []).filter((item) => item.id !== order.id)]);
      invalidate();
    },
  });
}

/** Cancel an order the shop hasn't moved on for over an hour, rating the shop. */
export function useCancelStalledOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: ({ id, rating, review }: { id: string; rating: number; review?: string }) =>
      ordersService.cancel(id, { rating, review }),
    onSettled: (_data, _error, { id }) => invalidate(id),
  });
}

export function useCancelOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (id: string) => ordersService.cancel(id),
    onSettled: (_data, _error, id) => invalidate(id),
  });
}

export function useRateOrder() {
  const invalidate = useInvalidateOrders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating, review }: { id: string; rating: number; review?: string }) =>
      ordersService.rate(id, rating, review),
    onSettled: (_data, _error, variables) => {
      invalidate(variables.id);
      // The shop's average just changed.
      queryClient.invalidateQueries({ queryKey: ['businesses', 'nearby'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}
