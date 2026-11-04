import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GOLD_DEEP } from './GoldCard';
import { useMySubscription } from '@/hooks/useSubscription';
import { freeUseFor, PassKind } from '@/services/subscriptionsService';
import { openSubscribe } from '@/state/subscribeStore';
import { fonts, typography, useThemeColors } from '@/theme';
import { FullText } from '@/components/FullText';

/** Shown once this few free ones (or fewer) are left this month. */
const FEW_LEFT = 2;

/**
 * A small line above a booking / order's final button, shown only when the month's free ones are
 * nearly or fully used: how many are left (or the fee now), with a tap to Triolo Plus — so the
 * customer can subscribe before they run out.
 */
export function FreeUsesNotice({ kind, style }: { kind: PassKind; style?: object }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data } = useMySubscription();
  if (!data?.enabled || data.active) return null;
  const free = freeUseFor(data, kind);
  if (!free || free.limit === null || free.limit <= 0) return null;
  const left = Math.max(0, free.limit - free.used);
  if (left > FEW_LEFT) return null;
  // Used up, but an earlier payment covers the next one (KeptPaymentNotice says so).
  if (left === 0 && (data.passes?.[kind] ?? 0) > 0) return null;
  const group = kind === 'quick_order' || kind === 'shop_order' ? 'orders' : 'bookings';
  const fee = data.fees?.[kind] ?? 0;
  const message =
    left > 0
      ? t(`freeUses.left.${group}`, { count: left })
      : fee > 0
        ? t(`freeUses.usedUpFee.${group}`, { amount: fee })
        : t(`freeUses.usedUp.${group}`);

  return (
    <Pressable
      onPress={openSubscribe}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: `${GOLD_DEEP}14`, borderColor: `${GOLD_DEEP}40`, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: `${GOLD_DEEP}22` }]}>
        <FontAwesome6 name={left > 0 ? 'gift' : 'crown'} size={13} color={GOLD_DEEP} solid />
      </View>
      <View style={styles.text}>
        <FullText style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {message}
        </FullText>
        <FullText style={[styles.cta, { color: GOLD_DEEP }]} numberOfLines={1}>
          {t('freeUses.cta')}
        </FullText>
      </View>
      <FontAwesome6 name="chevron-right" size={12} color={GOLD_DEEP} solid />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  title: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18 },
  cta: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
});
