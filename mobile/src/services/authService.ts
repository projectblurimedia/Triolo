import { apiClient } from './apiClient';
import { AccountLanguage, AccountRole, AuthAccount } from '@/state/authStore';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse extends AuthTokens {
  account: AuthAccount;
}

export const authService = {
  requestRegistrationOtp: (params: {
    fullName: string;
    mobileNumber: string;
    role: AccountRole;
    preferredLanguage: AccountLanguage;
  }) => apiClient.post<{ mobileNumber: string }>('/auth/register/request-otp', params),

  verifyRegistrationOtp: (params: { mobileNumber: string; otp: string }) =>
    apiClient.post<AuthResponse>('/auth/register/verify-otp', params),

  requestLoginOtp: (params: { mobileNumber: string }) =>
    apiClient.post<{ mobileNumber: string }>('/auth/login/request-otp', params),

  verifyLoginOtp: (params: { mobileNumber: string; otp: string }) =>
    apiClient.post<AuthResponse>('/auth/login/verify-otp', params),

  logout: (refreshToken: string) => apiClient.post<null>('/auth/logout', { refreshToken }),

  me: () => apiClient.get<AuthAccount>('/auth/me', true),

  updateLanguage: (preferredLanguage: AccountLanguage) =>
    apiClient.patch<{ preferredLanguage: AccountLanguage }>('/auth/me/language', { preferredLanguage }, true),
};
