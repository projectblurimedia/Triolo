import { apiClient } from './apiClient';

export const pushTokenService = {
  register: (token: string) => apiClient.patch<null>('/notifications/push-token', { token }, true),
};
