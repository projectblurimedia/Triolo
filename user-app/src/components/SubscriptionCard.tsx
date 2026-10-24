import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GoldCard, GOLD_INK, GOLD_INK_SOFT } from './GoldCard';
import { useMySubscription } from '@/hooks/useSubscription';
import { openSubscribe } from '@/state/subscribeStore';
import { formatDay } from '@/utils/formatDate';
import { fonts, typography } from '@/theme';

/** Profile's Triolo Plus card — gold and shining; only while the admin has plans on. */
export function SubscriptionCard() {
  const { t } = useTranslation();
  const { data } = useMySubscription();
  if (!data?.enabled) return null;
  const active = data.active;

  return (
    <Pressable onPress={openSubscribe} accessibilityRole="button" style={({ pressed }) => [styles.wrap, { opacity: pressed ? 0.9 : 1 }]}>
      <GoldCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.crown}>
            <FontAwesome6 name="crown" size={18} color="#8A5300" solid />
          </View>
          <View style={styles.text}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{t('subscribe.cardBrand')}</Text>
              {active ? (
                <View style={styles.activePill}>
                  <FontAwesome6 name="check" size={9} color="#FFFFFF" solid />
                  <Text style={styles.activeText}>{t('subscribe.activeShort')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.subtitle} numberOfLines={2}>
              {active ? t('subscribe.activeUntil', { date: formatDay(active.endsAt) }) : t('subscribe.cardText')}
            </Text>
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{active ? t('subscribe.manage') : t('subscribe.get')}</Text>
          </View>
        </View>
      </GoldCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Same gap as the cards around it (the hero above keeps its own 20 below).
  wrap: { marginTop: 2, marginBottom: 22 },
  card: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crown: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, color: GOLD_INK, lineHeight: 22 },
  subtitle: { ...typography.caption, color: GOLD_INK_SOFT, marginTop: 2, lineHeight: 16 },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#15803D',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activeText: { ...typography.caption, fontSize: 10, color: '#FFFFFF', fontFamily: fonts.semiBold },
  cta: { backgroundColor: GOLD_INK, borderRadius: 14, paddingHorizontal: 12, height: 30, justifyContent: 'center' },
  ctaText: { ...typography.caption, color: '#FFE29A', fontFamily: fonts.semiBold },
});
