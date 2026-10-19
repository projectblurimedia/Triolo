import { z } from 'zod';
import { createOrderSchema, customerCancelSchema, rateOrderSchema, saveItemsSchema, shopCancelSchema, verifyOrderPinSchema } from './validation';

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type SaveItemsDto = z.infer<typeof saveItemsSchema>;
export type VerifyOrderPinDto = z.infer<typeof verifyOrderPinSchema>;
export type RateOrderDto = z.infer<typeof rateOrderSchema>;
export type CustomerCancelDto = z.infer<typeof customerCancelSchema>;
export type ShopCancelDto = z.infer<typeof shopCancelSchema>;
