import { z } from 'zod';

export const setVerificationStatusSchema = z.object({
  status: z.enum(['verified', 'rejected']),
});

// Query params arrive as strings (Express doesn't coerce) — z.coerce for the numeric ones.
const paging = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
};

export const listQuerySchema = z.object({
  status: z.enum(['pending_verification', 'verified', 'rejected']).optional(),
  ...paging,
});

export const accountListQuerySchema = z.object({
  status: z.enum(['active', 'suspended', 'blocked']).optional(),
  ...paging,
});

export const bookingListQuerySchema = z.object({
  kind: z.enum(['quick', 'problem']).optional(),
  group: z.enum(['active', 'completed', 'cancelled', 'expired']).optional(),
  ...paging,
});

export const orderListQuerySchema = z.object({
  group: z.enum(['new', 'active', 'completed', 'cancelled']).optional(),
  ...paging,
});

export const problemListQuerySchema = z.object({
  group: z.enum(['open', 'in_progress', 'completed', 'closed']).optional(),
  ...paging,
});

export const jobPostListQuerySchema = z.object({
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  ...paging,
});

const reason = z.string().trim().max(300).optional();

export const moderateAccountSchema = z
  .object({
    action: z.enum(['suspend', 'ban', 'reactivate']),
    days: z.number().int().min(1).max(365).optional(),
    reason,
  })
  .refine((value) => value.action !== 'suspend' || value.days !== undefined, {
    message: 'Choose how many days to suspend for',
    path: ['days'],
  });

export const reasonSchema = z.object({ reason }).default({});

export const jobPostActiveSchema = z.object({ isActive: z.boolean(), reason });
