import { z } from 'zod';
import { MAX_BULK_DELETE } from './interfaces';

export const registerPushTokenSchema = z.object({
  token: z.string().trim().min(1, 'Push token is required'),
  /** Which app this device token is for; older app versions don't send it. */
  app: z.enum(['user', 'partner']).optional(),
  /** This build can show a full-screen pop-up for a new job / order (Partner app 1.3+). */
  fullScreen: z.boolean().optional(),
});

export const unregisterPushTokenSchema = z.object({
  app: z.enum(['user', 'partner']),
  token: z.string().trim().min(1).optional(),
});

// Bulk delete from the selection mode in both apps' notification lists.
export const deleteNotificationsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_BULK_DELETE),
});
