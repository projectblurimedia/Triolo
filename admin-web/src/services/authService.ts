import { apiClient } from './apiClient';
import { AuthAccount } from '@/state/authStore';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  account: AuthAccount;
}

export const authService = {
  requestRegistrationOtp: (params: {
    fullName: string;
    mobileNumber: string;
    email: string;
    latitude: number | null;
    longitude: number | null;
    locationAddress: string;
    preferredLanguage: string;
  }) => apiClient.post<{ mobileNumber: string }>('/auth/register/request-otp', params),

  verifyRegistrationOtp: (params: { mobileNumber: string; otp: string }) =>
    apiClient.post<AuthResponse>('/auth/register/verify-otp', params),

  requestLoginOtp: (params: { mobileNumber: string }) =>
    apiClient.post<{ mobileNumber: string }>('/auth/login/request-otp', params),

  verifyLoginOtp: (params: { mobileNumber: string; otp: string }) =>
    apiClient.post<AuthResponse>('/auth/login/verify-otp', params),

  me: () => apiClient.get<AuthAccount>('/auth/me', true),
};
