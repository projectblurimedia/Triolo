import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { useAuthStore, AccountLanguage, AccountRole } from '@/state/authStore';

export function useRequestRegistrationOtp() {
  return useMutation({
    mutationFn: (params: { fullName: string; mobileNumber: string; role: AccountRole; preferredLanguage: AccountLanguage }) =>
      authService.requestRegistrationOtp(params),
  });
}

export function useVerifyRegistrationOtp() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: (params: { mobileNumber: string; otp: string }) => authService.verifyRegistrationOtp(params),
    onSuccess: (data) => setSession(data),
  });
}

export function useRequestLoginOtp() {
  return useMutation({
    mutationFn: (params: { mobileNumber: string }) => authService.requestLoginOtp(params),
  });
}

export function useVerifyLoginOtp() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: (params: { mobileNumber: string; otp: string }) => authService.verifyLoginOtp(params),
    onSuccess: (data) => setSession(data),
  });
}

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  return useMutation({
    mutationFn: () => authService.logout(refreshToken ?? ''),
    onSettled: () => clearSession(),
  });
}

/** Syncs a local language change to the account once logged in. See docs/localization.md. */
export function useUpdateAccountLanguage() {
  return useMutation({
    mutationFn: (preferredLanguage: AccountLanguage) => authService.updateLanguage(preferredLanguage),
  });
}
