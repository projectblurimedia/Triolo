import { z } from 'zod';

export const setVerificationStatusSchema = z.object({
  status: z.enum(['verified', 'rejected']),
});

// Query params arrive as strings (Express doesn't coerce) — z.coerce for the numeric ones,
// same convention workers/businesses' multipart validation already uses for the same reason.
export const listQuerySchema = z.object({
  status: z.enum(['pending_verification', 'verified', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
