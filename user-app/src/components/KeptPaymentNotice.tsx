import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMySubscription } from '@/hooks/useSubscription';
import { PassKind } from '@/services/subscriptionsService';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

/**
 * Shown on a booking / order that ended before anyone took it (no one answered, cancelled,
 * declined): when the customer had paid for it, that payment was given back as a credit, and the
 * next one of the same kind uses it instead of asking again. Shows only while that credit is
 * waiting (a paid, unused pass of this kind).
 */
export function KeptPaymentNotice({ kind, style }: { kind: PassKind; style?: object }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data } = useMySubscription();
  const kept = data?.enabled && !data.active ? (data.passes?.[kind] ?? 0) : 0;
  if (kept <= 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: `${brandColors.success}10`, borderColor: `${brandColors.success}40` }, style]}>
      <View style={[styles.icon, { backgroundColor: `${brandColors.success}1F` }]}>
        <FontAwesome6 name="wallet" size={15} color={brandColors.success} solid />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]}>{t('keptPayment.title')}</Text>
        <Text style={[styles.message, { color: colors.textMuted }]}>{t(`keptPayment.message.${kind}`)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12, alignSelf: 'stretch' },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  message: { ...typography.caption, fontSize: 12.5, lineHeight: 17 },
});
