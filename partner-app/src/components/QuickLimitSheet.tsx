import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { GlassBackdrop } from './Glass';
import { GoldCard, GOLD_DEEP, GOLD_INK, GOLD_INK_SOFT } from './GoldCard';
import { openSubscribe } from '@/state/subscribeStore';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

/**
 * Asked before accepting one of the last few free Quick Book jobs / Quick Orders of the month
 * (no plan): how many are left, a bar of the month's free accepts, and the plan for no limit —
 * or just accept.
 */
export function QuickLimitSheet({
  visible,
  side,
  remaining,
  limit,
  onAccept,
  onClose,
}: {
  visible: boolean;
  side: 'service' | 'shop';
  remaining: number;
  limit: number;
  onAccept: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const used = Math.max(0, limit - remaining);
  const share = limit > 0 ? Math.min(1, used / limit) : 1;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GlassBackdrop onPress={onClose} style={styles.center}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <GoldCard style={styles.hero}>
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <FontAwesome6 name="hourglass-half" size={18} color={GOLD_DEEP} solid />
              </View>
              <View style={styles.flex}>
                <Text style={styles.heroTitle}>{t('quickLimit.leftTitle', { count: remaining })}</Text>
                <Text style={styles.heroText}>{t(`quickLimit.kind.${side}`)}</Text>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${share * 100}%` }]} />
            </View>
            <Text style={styles.trackText}>{t('quickLimit.used', { used, limit })}</Text>
          </GoldCard>

          <Text style={[styles.message, { color: colors.textMuted }]}>{t(`quickLimit.message.${side}`, { limit })}</Text>

          <Pressable onPress={onAccept} accessibilityRole="button" style={({ pressed }) => [styles.acceptWrap, { opacity: pressed ? 0.9 : 1 }]}>
            <View style={[styles.accept, { backgroundColor: brandColors.success }]}>
              <FontAwesome6 name="check" size={13} color="#FFFFFF" solid />
              <Text style={styles.acceptText}>{t('quickLimit.acceptAnyway', { count: remaining })}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => {
              onClose();
              openSubscribe(side);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.planWrap, { opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient colors={['#2A1A00', '#3D2500']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.plan}>
              <FontAwesome6 name="crown" size={12} color="#FFE29A" solid />
              <Text style={styles.planText}>{t('quickLimit.subscribe')}</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={6}>
            <Text style={[styles.cancel, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </GlassBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 400, borderRadius: 24, borderWidth: 1, padding: 16, gap: 12, alignItems: 'center' },
  hero: { alignSelf: 'stretch', padding: 14, gap: 10 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: fonts.semiBold, fontSize: 18, lineHeight: 23, color: GOLD_INK },
  heroText: { ...typography.caption, fontFamily: fonts.medium, color: GOLD_INK_SOFT },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: GOLD_INK },
  trackText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, color: GOLD_INK },
  message: { ...typography.body, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  acceptWrap: { alignSelf: 'stretch' },
  accept: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  acceptText: { fontFamily: fonts.semiBold, fontSize: 14.5, color: '#FFFFFF', includeFontPadding: false },
  planWrap: { alignSelf: 'stretch', borderRadius: 24, overflow: 'hidden' },
  plan: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  planText: { fontFamily: fonts.semiBold, fontSize: 14, color: '#FFE29A', includeFontPadding: false },
  cancel: { ...typography.caption, marginTop: 2 },
});
