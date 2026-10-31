/**
 * What an order's list holds, for a card's line: "5 items", or "1 photo of the list" for a list
 * the customer sent as a photo of a written list (no typed items).
 */
export function orderListText(
  t: (key: string, options?: Record<string, unknown>) => string,
  order: { items: unknown[]; listPhotoUrls?: string[] },
  itemsKey = 'continueSteps.itemCount',
): string {
  const photos = order.listPhotoUrls?.length ?? 0;
  if (order.items.length === 0 && photos > 0) return t('shopOrders.photoListLine', { count: photos });
  return t(itemsKey, { count: order.items.length });
}
