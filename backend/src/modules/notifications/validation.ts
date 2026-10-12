import { z } from 'zod';
import { MAX_BULK_DELETE } from './interfaces';

export const registerPushTokenSchema = z.object({
  token: z.string().trim().min(1, 'Push token is required'),
});

// Bulk delete from the selection mode in both apps' notification lists.
export const deleteNotificationsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_BULK_DELETE),
});
