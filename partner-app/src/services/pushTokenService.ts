import { apiClient } from './apiClient';

// This phone's token is stored per app: job offers go to the partner app and booking updates
// to the user app, even when the same account is signed in to both.
const APP = 'partner' as const;

export const pushTokenService = {
  register: (token: string) => apiClient.patch<null>('/notifications/push-token', { token, app: APP }, true),
  /** On logout: this phone stops getting this account's notifications in this app. */
  remove: () => apiClient.post<null>('/notifications/push-token/remove', { app: APP }, true),
};
