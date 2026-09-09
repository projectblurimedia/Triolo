import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { useAuthStore, AccountLanguage } from '@/state/authStore';

// No useRequestRegistrationOtp/useVerifyRegistrationOtp here — registration's OTP flow is
// now inline inside components/PhoneVerification.tsx, which calls authService's
// requestRegistrationOtp/verifyRegistrationOtp directly rather than through a react-query
// mutation hook (it needs to branch to the login endpoints first and only fall back to
// these on ACCOUNT_NOT_FOUND, which doesn't map cleanly onto a single mutation).

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
  const setLoggingOut = useAuthStore((state) => state.setLoggingOut);
  return useMutation({
    mutationFn: () => authService.logout(refreshToken ?? ''),
    onMutate: () => setLoggingOut(true),
    // Clear the session first so RootNavigator swaps to the Welcome screen underneath
    // the overlay, then hide the overlay — it fades away to reveal Welcome already in
    // place, instead of a flash of the old screen before the swap catches up.
    onSettled: () => {
      clearSession();
      setLoggingOut(false);
    },
  });
}

/** Syncs a local language change to the account once logged in. See docs/localization.md. */
export function useUpdateAccountLanguage() {
  return useMutation({
    mutationFn: (preferredLanguage: AccountLanguage) => authService.updateLanguage(preferredLanguage),
  });
}
