import { z } from 'zod';
import { BADGE_KINDS, PARTNER_PLANS, PASS_KINDS, SUBSCRIPTION_AUDIENCES, SUBSCRIPTION_MONTHS } from './interfaces';

const months = z
  .number()
  .int()
  .refine((value) => (SUBSCRIPTION_MONTHS as readonly number[]).includes(value), 'Choose 1, 3, 6 or 12 months');

export const audienceQuerySchema = z.object({ audience: z.enum(SUBSCRIPTION_AUDIENCES) });

// 'all' = the all-in-one partner plan (services, shop and job posts together).
export const checkoutSchema = z.object({ audience: z.enum(SUBSCRIPTION_AUDIENCES), months, plan: z.enum([...PARTNER_PLANS, 'all']).optional() });

export const badgeCheckoutSchema = z.object({ kind: z.enum(BADGE_KINDS), profileId: z.string().uuid().optional() });

const price = z.number().int().min(0).max(100000);
const prices = z.object({ '1': price, '3': price, '6': price, '12': price });

export const subscriptionSettingsSchema = z
  .object({
    subscriptionsEnabled: z.boolean(),
    customerEnabled: z.boolean(),
    partnerEnabled: z.boolean(),
    customerPrices: prices,
    partnerPrices: prices,
    partnerPlanPrices: z.object({ service: prices, shop: prices, job_post: prices }),
    headStartSeconds: z.number().int().min(0).max(600),
    badgeEnabled: z.boolean(),
    badgePrice: price,
    badgeMinRating: z.number().min(1).max(5),
    badgeMinRatings: z.number().int().min(1).max(100),
    customerFees: z.object({ book: price, order: price, staffContact: price }),
    partnerFees: z.object({ accept: price, jobPost: price }),
  })
  .partial();

export const passCheckoutSchema = z.object({
  kind: z.enum(PASS_KINDS),
  // staff_contact: the job post whose phone number it unlocks.
  targetId: z.string().uuid().optional(),
  // accept: which side's plan would make it free (services for jobs, shop for orders).
  plan: z.enum(PARTNER_PLANS).optional(),
});

export const passListQuerySchema = z.object({
  kind: z.enum(PASS_KINDS).optional().or(z.literal('').transform(() => undefined)),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const subscriptionListQuerySchema = z.object({
  audience: z.enum(SUBSCRIPTION_AUDIENCES).optional().or(z.literal('').transform(() => undefined)),
  state: z.enum(['active', 'ended', 'unpaid']).optional().or(z.literal('').transform(() => undefined)),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const badgeListQuerySchema = z.object({
  status: z.enum(['active', 'removed']).optional().or(z.literal('').transform(() => undefined)),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const removeBadgeSchema = z.object({ reason: z.string().trim().min(3, 'Say why it is removed').max(300) });

/** In-app checkout: which unpaid pass / plan / badge to open Razorpay's screen for. */
export const inAppOrderSchema = z.object({
  type: z.enum(['pass', 'subscription', 'badge']),
  id: z.string().uuid(),
});

/** What Razorpay's in-app screen hands back after a payment. */
export const inAppConfirmSchema = inAppOrderSchema.extend({
  razorpayOrderId: z.string().min(1).max(64),
  razorpayPaymentId: z.string().min(1).max(64),
  razorpaySignature: z.string().min(1).max(256),
});
