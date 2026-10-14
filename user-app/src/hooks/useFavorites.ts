import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { favoritesService, FavoritesList, FavoriteType } from '@/services/favoritesService';
import { useAuthStore } from '@/state/authStore';
import { showToast } from '@/state/toastStore';
import i18n from '@/localization/i18n';

export const FAVORITES_QUERY_KEY = ['favorites'];

export function useFavorites() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({ queryKey: FAVORITES_QUERY_KEY, queryFn: favoritesService.list, enabled: !!accessToken, staleTime: 60_000 });
}

/** Whether a worker/shop is saved, plus a toggle that updates the heart immediately. */
export function useFavoriteToggle(type: FavoriteType, id: string | null) {
  const queryClient = useQueryClient();
  const { data } = useFavorites();
  const list = type === 'worker' ? data?.workers : data?.businesses;
  const saved = !!id && !!list?.some((item) => item.id === id);

  const mutation = useMutation({
    mutationFn: (nextSaved: boolean) =>
      nextSaved ? favoritesService.add(type, id as string) : favoritesService.remove(type, id as string),
    // Optimistic: flip the heart now, roll back if the request fails.
    onMutate: async (nextSaved: boolean) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_QUERY_KEY });
      const previous = queryClient.getQueryData<FavoritesList>(FAVORITES_QUERY_KEY);
      if (previous && !nextSaved) {
        queryClient.setQueryData<FavoritesList>(FAVORITES_QUERY_KEY, {
          workers: type === 'worker' ? previous.workers.filter((item) => item.id !== id) : previous.workers,
          businesses: type === 'business' ? previous.businesses.filter((item) => item.id !== id) : previous.businesses,
        });
      }
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(FAVORITES_QUERY_KEY, context.previous);
      showToast({ variant: 'error', title: i18n.t('common.errorTitle'), message: i18n.t('errors.generic') });
    },
    onSuccess: (_data, nextSaved) => {
      showToast({ variant: 'success', title: i18n.t(nextSaved ? 'favorites.savedToast' : 'favorites.removedToast') });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY }),
  });

  return { saved, toggle: () => id && mutation.mutate(!saved), pending: mutation.isPending };
}
