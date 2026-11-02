/**
 * What an order's list holds, for a card's line: "5 items", "1 photo of the list" for a list the
 * customer sent as a photo of a written list, and "Voice 0:12" when they spoke it.
 */
export function orderListText(
  t: (key: string, options?: Record<string, unknown>) => string,
  order: { items: unknown[]; listPhotoUrls?: string[]; listVoiceUrl?: string | null; listVoiceSeconds?: number | null },
  itemsKey = 'continueSteps.itemCount',
): string {
  const photos = order.listPhotoUrls?.length ?? 0;
  const voice = order.listVoiceUrl ? t('voice.countLine', { length: formatLength(order.listVoiceSeconds ?? 0) }) : '';
  const list =
    order.items.length > 0
      ? t(itemsKey, { count: order.items.length })
      : photos > 0
        ? t('shopOrders.photoListLine', { count: photos })
        : voice
          ? ''
          : t(itemsKey, { count: 0 });
  return [list, voice].filter(Boolean).join(' · ');
}

function formatLength(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
