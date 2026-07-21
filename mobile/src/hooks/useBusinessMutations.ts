import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  businessesService,
  CreateBusinessProfileParams,
  UpdateBusinessProfileParams,
} from '@/services/businessesService';

export const BUSINESS_PROFILE_QUERY_KEY = ['businesses', 'me', 'profile'];

export function useMyBusinessProfile() {
  return useQuery({ queryKey: BUSINESS_PROFILE_QUERY_KEY, queryFn: businessesService.getMyProfile });
}

export function useCreateBusinessProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateBusinessProfileParams) => businessesService.createProfile(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BUSINESS_PROFILE_QUERY_KEY }),
  });
}

export function useUpdateBusinessProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: UpdateBusinessProfileParams) => businessesService.updateProfile(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BUSINESS_PROFILE_QUERY_KEY }),
  });
}

export function useDeleteBusinessProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => businessesService.deleteProfile(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BUSINESS_PROFILE_QUERY_KEY }),
  });
}
