import { z } from 'zod';
import { AD_APPS, AD_ORIENTATIONS, AD_PAYMENT_METHODS, AD_PLACEMENTS, AD_PLAN_DAYS } from './interfaces';

const optionalText = (max: number) => z.string().trim().max(max).nullish();
const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\- ]{6,15}$/, 'Enter a valid phone number')
  .nullish()
  .or(z.literal(''));

export const saveAdSchema = z.object({
  advertiserName: z.string().trim().min(2, 'Enter the business name').max(80),
  advertiserPhone: phone,
  title: optionalText(80),
  description: optionalText(600),
  orientation: z.enum(AD_ORIENTATIONS),
  displaySeconds: z.number().int().min(3, 'At least 3 seconds').max(30, 'At most 30 seconds').default(15),
  latitude: z.number().min(-90).max(90, 'Set where the ad is'),
  longitude: z.number().min(-180).max(180),
  locationText: z.string().trim().min(2, 'Set where the ad is').max(120),
  // A web address; "https://" may be left out (it's added). Only http(s) links are allowed.
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === '' || /^(https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]{2,}/i.test(value), 'Enter a valid web link')
    .refine((value) => !/^[a-z][a-z0-9+.-]*:/i.test(value) || /^https?:/i.test(value), 'Only web (https) links')
    // Optional: not every shop has a website.
    .nullish(),
  // The ad's image or video, already uploaded to Cloudinary; saved together with the ad.
  imageUrl: z.string().url().nullish(),
  videoUrl: z.string().url().nullish(),
  planDays: z
    .number()
    .int()
    .refine((days) => (AD_PLAN_DAYS as readonly number[]).includes(days), 'Choose 1, 3, 7 or 30 days'),
  // 'pending' = not paid yet (a business's own booking, until the admin records the payment).
  paymentMethod: z.enum([...AD_PAYMENT_METHODS, 'pending'] as [string, ...string[]]).default('cash'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date'),
});

export const adSettingsSchema = z
  .object({
    adsEnabled: z.boolean(),
    launchUser: z.boolean(),
    launchPartner: z.boolean(),
    actionUser: z.boolean(),
    actionPartner: z.boolean(),
    prices: z.object({
      '1': z.number().int().min(0).max(100000),
      '3': z.number().int().min(0).max(100000),
      '7': z.number().int().min(0).max(100000),
      '30': z.number().int().min(0).max(100000),
    }),
  })
  .partial();

/**
 * A business booking its own ad on the Triolo Ads website: like the admin's form, minus how it
 * was paid (online payment comes later — it's 'pending' until then) and with its image or
 * video required.
 */
export const selfAdSchema = saveAdSchema
  .omit({ paymentMethod: true })
  .extend({ advertiserName: z.string().trim().min(2, 'Enter your business name').max(80) })
  .refine((body) => !!body.imageUrl !== !!body.videoUrl, 'Add one image or one video');

export const reviewAdSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    note: z.string().trim().max(300).optional(),
  })
  .refine((body) => body.decision === 'approve' || !!body.note, { message: 'Say why it was rejected', path: ['note'] });

export const adListQuerySchema = z.object({
  status: z
    .enum(['in_review', 'rejected', 'scheduled', 'running', 'ended', 'deleted'])
    .optional()
    .or(z.literal('').transform(() => undefined)),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uploadSignatureSchema = z.object({ kind: z.enum(['image', 'video']) });

/** Exactly one piece of media: an image or a video. */
export const adMediaSchema = z
  .object({
    imageUrl: z.string().url().nullable().optional(),
    videoUrl: z.string().url().nullable().optional(),
  })
  .refine((body) => !!body.imageUrl !== !!body.videoUrl, 'Add one image or one video');

export const serveQuerySchema = z.object({
  app: z.enum(AD_APPS),
  placement: z.enum(AD_PLACEMENTS),
  exclude: z.string().uuid().optional(),
  // Ads are local: the viewer's position decides which ads are near enough to show.
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});
