import { TFunction } from 'i18next';
import { CustomerOrder } from '@/services/ordersService';

/** The shop's name — or, for a Quick Order no shop has taken yet, what it is doing. */
export function orderShopName(order: Pick<CustomerOrder, 'quick' | 'businessId' | 'shop'>, t: TFunction): string {
  if (order.quick && !order.businessId) return t('quickOrder.findingShop');
  return order.shop.name;
}
