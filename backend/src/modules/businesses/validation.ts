import { z } from 'zod';
import { BUSINESS_SHOP_CATEGORIES } from './interfaces';
import { parseBooleanIfString, parseJsonIfString } from '@/common/utils/parseMultipartField';

// multipart/form-data fields all arrive as strings (multer doesn't coerce types), so
// nullable/boolean fields use z.coerce/preprocess here, and the array field is
// JSON-stringified by the client and parsed back — unlike the JSON-body schemas
// elsewhere.
export const createBusinessProfileSchema = z
  .object({
    shopName: z.string().trim().min(2, 'Shop name is too short').max(150),
    shopCategories: z.preprocess(
      parseJsonIfString,
      z.array(z.enum(BUSINESS_SHOP_CATEGORIES as [string, ...string[]])).min(1, 'Select at least one category'),
    ),
    otherCategoryDescription: z.string().trim().max(100).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    locationAddress: z.string().trim().min(2).max(255).optional(),
    deliveryAvailable: z.preprocess(parseBooleanIfString, z.boolean()),
    deliveryPricePerKm: z.coerce.number().min(0).max(1000).optional(),
  })
  .refine((data) => !data.shopCategories.includes('other') || !!data.otherCategoryDescription, {
    message: 'Please describe your shop category',
    path: ['otherCategoryDescription'],
  })
  .refine((data) => !data.deliveryAvailable || data.deliveryPricePerKm !== undefined, {
    message: 'Enter a price per km for delivery',
    path: ['deliveryPricePerKm'],
  });

export const updateBusinessProfileSchema = z
  .object({
    shopName: z.string().trim().min(2, 'Shop name is too short').max(150),
    shopCategories: z.preprocess(
      parseJsonIfString,
      z.array(z.enum(BUSINESS_SHOP_CATEGORIES as [string, ...string[]])).min(1, 'Select at least one category'),
    ),
    otherCategoryDescription: z.string().trim().max(100).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    locationAddress: z.string().trim().min(2).max(255).optional(),
    deliveryAvailable: z.preprocess(parseBooleanIfString, z.boolean()),
    deliveryPricePerKm: z.coerce.number().min(0).max(1000).optional(),
    existingPhotoUrls: z.preprocess(parseJsonIfString, z.array(z.string())).optional(),
  })
  .refine((data) => !data.shopCategories.includes('other') || !!data.otherCategoryDescription, {
    message: 'Please describe your shop category',
    path: ['otherCategoryDescription'],
  })
  .refine((data) => !data.deliveryAvailable || data.deliveryPricePerKm !== undefined, {
    message: 'Enter a price per km for delivery',
    path: ['deliveryPricePerKm'],
  });
