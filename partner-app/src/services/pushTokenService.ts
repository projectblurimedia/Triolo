import { LivePopup } from '../../modules/live-popup';
import { apiClient } from './apiClient';

// This phone's token is stored per app: job offers go to the partner app and booking updates
// to the user app, even when the same account is signed in to both.
const APP = 'partner' as const;

export const pushTokenService = {
  // fullScreen: this build can show the full-screen pop-up for new jobs / orders (1.3+).
  register: (token: string) =>
    apiClient.patch<null>('/notifications/push-token', { token, app: APP, fullScreen: !!LivePopup }, true),
  /** On logout: this phone stops getting this account's notifications in this app. */
  remove: () => apiClient.post<null>('/notifications/push-token/remove', { app: APP }, true),
};
