import { z } from 'zod';
import { BUSINESS_SHOP_CATEGORIES } from './interfaces';

// multipart/form-data fields all arrive as strings (multer doesn't coerce types), so
// nullable fields use z.coerce here — unlike the JSON-body schemas elsewhere.
export const createBusinessProfileSchema = z.object({
  shopName: z.string().trim().min(2, 'Shop name is too short').max(150),
  shopCategory: z.enum(BUSINESS_SHOP_CATEGORIES as [string, ...string[]]),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  locationAddress: z.string().trim().min(2).max(255).optional(),
});
