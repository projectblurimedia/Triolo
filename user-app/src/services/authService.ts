import { apiClient } from './apiClient';
import { AccountLanguage, AuthAccount } from '@/state/authStore';
import { PickedImage } from '@/components/ImagePickerField';

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
    // Only name and mobile are needed: RegisterScreen verifies the phone first and saves the
    // rest with PATCH /auth/me when the form is submitted.
    email?: string;
    latitude?: number | null;
    longitude?: number | null;
    locationAddress?: string;
    preferredLanguage?: AccountLanguage;
  }) => apiClient.post<{ mobileNumber: string }>('/auth/register/request-otp', params),

  verifyRegistrationOtp: (params: { mobileNumber: string; otp: string }) =>
    apiClient.post<AuthResponse>('/auth/register/verify-otp', params),

  requestLoginOtp: (params: { mobileNumber: string }) =>
    apiClient.post<{ mobileNumber: string }>('/auth/login/request-otp', params),

  verifyLoginOtp: (params: { mobileNumber: string; otp: string }) =>
    apiClient.post<AuthResponse>('/auth/login/verify-otp', params),

  logout: (refreshToken: string) => apiClient.post<null>('/auth/logout', { refreshToken }),

  me: () => apiClient.get<AuthAccount>('/auth/me', true),

  /** Edit Profile: only the fields given change; an empty email clears it. */
  updateProfile: (fields: {
    fullName?: string;
    email?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    locationAddress?: string | null;
  }) => apiClient.patch<AuthAccount>('/auth/me', fields, true),

  uploadPhoto: (image: PickedImage) => {
    const formData = new FormData();
    // React Native's FormData takes this {uri, name, type} file shape.
    formData.append('photo', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    return apiClient.putForm<AuthAccount>('/auth/me/photo', formData);
  },

  removePhoto: () => apiClient.delete<AuthAccount>('/auth/me/photo', true),

  updateLanguage: (preferredLanguage: AccountLanguage) =>
    apiClient.patch<{ preferredLanguage: AccountLanguage }>('/auth/me/language', { preferredLanguage }, true),
};
