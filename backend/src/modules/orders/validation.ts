import { z } from 'zod';
import { MAX_ORDER_ITEMS } from './interfaces';

const orderItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(100),
  quantity: z.string().trim().min(1).max(20).default('1'),
  unit: z.string().trim().max(20).nullish(),
});

export const createOrderSchema = z.object({
  businessId: z.string().uuid(),
  fulfillment: z.enum(['pickup', 'delivery']),
  items: z.array(orderItemSchema).min(1, 'Add at least one item').max(MAX_ORDER_ITEMS),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAddress: z.string().trim().max(300).optional(),
  note: z.string().trim().max(300).optional(),
});

/** The shop's checklist: each item packed (with its price) or unavailable. */
export const saveItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['pending', 'packed', 'unavailable']),
        price: z.number().min(0).max(1000000).nullish(),
      }),
    )
    .min(1)
    .max(MAX_ORDER_ITEMS),
});

export const verifyOrderPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'Enter the 4-digit PIN'),
});

export const rateOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().max(300).optional(),
});

export const shopCancelSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});
