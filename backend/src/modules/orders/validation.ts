import { z } from 'zod';
import { MAX_LIST_PHOTOS, MAX_LIST_VOICE_SECONDS, MAX_ORDER_ITEMS } from './interfaces';

const orderItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(100),
  quantity: z.string().trim().min(1).max(20).default('1'),
  unit: z.string().trim().max(20).nullish(),
});

// Photos of a written list, uploaded first (POST /orders/list-photos).
const listPhotosSchema = z.array(z.string().url().max(500)).max(MAX_LIST_PHOTOS).default([]);
// A spoken list, uploaded first (POST /orders/list-voice).
const listVoiceUrlSchema = z.string().url().max(500).nullish();
const listVoiceSecondsSchema = z.number().int().min(1).max(MAX_LIST_VOICE_SECONDS).nullish();
// A list is typed items, photos of a written list, a voice message, or any mix — never nothing.
const hasItemsOrPhotos = (body: { items: unknown[]; listPhotoUrls: unknown[]; listVoiceUrl?: string | null }) =>
  body.items.length > 0 || body.listPhotoUrls.length > 0 || !!body.listVoiceUrl;
const itemsOrPhotosMessage = { message: 'Add at least one item, a photo or a voice message of your list', path: ['items'] };

export const createOrderSchema = z
  .object({
  businessId: z.string().uuid(),
  fulfillment: z.enum(['pickup', 'delivery']),
  items: z.array(orderItemSchema).max(MAX_ORDER_ITEMS).default([]),
  listPhotoUrls: listPhotosSchema,
  listVoiceUrl: listVoiceUrlSchema,
  listVoiceSeconds: listVoiceSecondsSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAddress: z.string().trim().max(300).optional(),
  note: z.string().trim().max(300).optional(),
})
  .refine(hasItemsOrPhotos, itemsOrPhotosMessage);

/** Quick Order: the list goes to every matching shop nearby; the first to accept gets it. */
export const createQuickOrderSchema = z
  .object({
  // Fixed kinds and / or names shops typed themselves ("Fancy").
  shopCategories: z.array(z.string().trim().min(1).max(40)).min(1, 'Choose a kind of shop').max(10),
  fulfillment: z.enum(['pickup', 'delivery']),
  items: z.array(orderItemSchema).max(MAX_ORDER_ITEMS).default([]),
  listPhotoUrls: listPhotosSchema,
  listVoiceUrl: listVoiceUrlSchema,
  listVoiceSeconds: listVoiceSecondsSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAddress: z.string().trim().max(300).optional(),
  note: z.string().trim().max(300).optional(),
})
  .refine(hasItemsOrPhotos, itemsOrPhotosMessage);

/**
 * The shop's checklist: each item packed (with its price) or unavailable. An entry with no id is
 * a new item the shop typed in (read from the list's photos); one the shop added earlier and
 * left out is removed.
 */
export const saveItemsSchema = z.object({
  items: z
    .array(
      z
        .object({
          id: z.string().uuid().optional(),
          name: z.string().trim().max(100).optional(),
          quantity: z.string().trim().max(20).optional(),
          unit: z.string().trim().max(20).nullish(),
          status: z.enum(['pending', 'packed', 'unavailable']),
          price: z.number().min(0).max(1000000).nullish(),
        })
        .refine((item) => !!item.id || !!item.name, { message: 'Item name is required', path: ['name'] }),
    )
    .max(MAX_ORDER_ITEMS),
  // The bill's photos / voice message (uploaded through /orders/list-photos and /list-voice) and
  // a typed total for when items aren't priced one by one. Left out: kept as it was.
  bill: z
    .object({
      photoUrls: z.array(z.string().url().max(500)).max(MAX_LIST_PHOTOS).default([]),
      voiceUrl: z.string().url().max(500).nullish(),
      voiceSeconds: z.number().int().min(1).max(MAX_LIST_VOICE_SECONDS).nullish(),
      amount: z.number().min(0).max(1000000).nullish(),
    })
    .optional(),
});

export const verifyOrderPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'Enter the 4-digit PIN'),
  /** Did the customer pay at handover? Defaults to yes. */
  paid: z.boolean().optional(),
});

export const rateOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().max(300).optional(),
});

// A plain cancel sends nothing; cancelling a stalled order sends the shop's rating.
export const customerCancelSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    review: z.string().trim().max(300).optional(),
  })
  .default({});

export const shopCancelSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const assignDeliverySchema = z.object({ staffAccountId: z.string().uuid().nullable() });

export const staffLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
