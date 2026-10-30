import { syncProfilePhoto } from './profilePhotoSync';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { businessesService, CreateBusinessProfileParams, UpdateBusinessProfileParams } from '@/services/businessesService';
import { useAuthStore } from '@/state/authStore';
import { showToast } from '@/state/toastStore';
import i18n from '@/localization/i18n';

export const BUSINESS_PROFILE_QUERY_KEY = ['businesses', 'me', 'profile'];
/** Every shop the partner owns (a partner may own several). */
export const MY_SHOPS_QUERY_KEY = ['businesses', 'me', 'shops'];
export const STAFF_SHOPS_QUERY_KEY = ['businesses', 'staff', 'me'];

/** The partner's first shop (verified first), or null — "do they have a shop at all". */
export function useMyBusinessProfile(enabled = true) {
  return useQuery({ queryKey: BUSINESS_PROFILE_QUERY_KEY, queryFn: () => businessesService.getMyProfile(), enabled });
}

export function useMyShops(enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({ queryKey: MY_SHOPS_QUERY_KEY, queryFn: businessesService.listMine, enabled: enabled && !!accessToken });
}

/** One of the partner's shops by id (the first shop when no id). */
export function useMyShop(shopId?: string) {
  const shops = useMyShops(!!shopId);
  const first = useMyBusinessProfile(!shopId);
  if (!shopId) return { data: first.data, isLoading: first.isLoading };
  return { data: shops.data ? shops.data.find((shop) => shop.id === shopId) ?? null : undefined, isLoading: shops.isLoading };
}

/** The shops this account delivers for (an owner added them as delivery staff). */
export function useStaffShops() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({ queryKey: STAFF_SHOPS_QUERY_KEY, queryFn: businessesService.staffShops, enabled: !!accessToken, staleTime: 60_000 });
}

export const STAFF_INVITES_QUERY_KEY = ['businesses', 'staff', 'invites'];

/** Shops that invited this account to deliver (answered on Home / Choose Capability). */
export function useStaffInvites() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: STAFF_INVITES_QUERY_KEY,
    queryFn: businessesService.staffInvites,
    enabled: !!accessToken,
    refetchInterval: 30_000,
  });
}

export function useAnswerStaffInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, accept }: { businessId: string; accept: boolean }) => businessesService.answerInvite(businessId, accept),
    onSuccess: (invites) => {
      queryClient.setQueryData(STAFF_INVITES_QUERY_KEY, invites);
      queryClient.invalidateQueries({ queryKey: STAFF_SHOPS_QUERY_KEY });
    },
  });
}

function useRefreshShops() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: BUSINESS_PROFILE_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: MY_SHOPS_QUERY_KEY });
  };
}

export function useCreateBusinessProfile() {
  const refresh = useRefreshShops();
  return useMutation({
    mutationFn: async (params: CreateBusinessProfileParams) => {
      const saved = await businessesService.createProfile(params);
      // The photo goes to this new shop, not the partner's first one.
      await syncProfilePhoto(
        params.profilePhoto,
        (image) => businessesService.uploadProfilePhoto(image, saved?.id),
        () => businessesService.removeProfilePhoto(saved?.id),
      );
      // Delivery staff typed in the form: added to the new shop (one failing doesn't undo it).
      if (saved?.id && params.deliveryAvailable && params.staff?.length) {
        const results = await Promise.allSettled(params.staff.map((member) => businessesService.addStaff(saved.id, member)));
        if (results.some((result) => result.status === 'rejected')) {
          showToast({ variant: 'error', title: i18n.t('deliveryStaff.someNotAdded') });
        }
      }
      return saved;
    },
    onSuccess: refresh,
  });
}

export function useUpdateBusinessProfile() {
  const refresh = useRefreshShops();
  return useMutation({
    mutationFn: async ({ shopId, ...params }: UpdateBusinessProfileParams & { shopId?: string }) => {
      const saved = await businessesService.updateProfile(params, shopId);
      await syncProfilePhoto(
        params.profilePhoto,
        (image) => businessesService.uploadProfilePhoto(image, shopId),
        () => businessesService.removeProfilePhoto(shopId),
      );
      return saved;
    },
    onSuccess: refresh,
  });
}

export function useDeleteBusinessProfile() {
  const refresh = useRefreshShops();
  return useMutation({
    mutationFn: (shopId?: string) => businessesService.deleteProfile(shopId),
    onSuccess: refresh,
  });
}

export const shopStaffKey = (shopId: string) => ['businesses', 'me', 'shops', shopId, 'staff'];

export function useShopStaff(shopId?: string) {
  return useQuery({ queryKey: shopStaffKey(shopId ?? ''), queryFn: () => businessesService.listStaff(shopId as string), enabled: !!shopId });
}

export function useAddShopStaff(shopId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (member: { fullName: string; mobileNumber: string }) => businessesService.addStaff(shopId, member),
    onSuccess: (staff) => queryClient.setQueryData(shopStaffKey(shopId), staff),
  });
}

export function useRemoveShopStaff(shopId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (staffId: string) => businessesService.removeStaff(shopId, staffId),
    onSuccess: (staff) => queryClient.setQueryData(shopStaffKey(shopId), staff),
  });
}
