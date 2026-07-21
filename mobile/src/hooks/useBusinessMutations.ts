import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { businessesService, CreateBusinessProfileParams } from '@/services/businessesService';

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
