import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  token: z.string().trim().min(1, 'Push token is required'),
});
