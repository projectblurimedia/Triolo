import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useStaffShops } from '@/hooks/useBusinessMutations';
import { useMyDeliveries } from '@/hooks/useDeliveries';
import { openDeliveries } from '@/state/deliveriesStore';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

/**
 * Shown only to someone a shop owner added as delivery staff: opens their deliveries. Looks like
 * Home's All bookings / All shop orders button (a light card, blue icon and arrow); the count is
 * how many are waiting for them or on the way.
 */
export function StaffDeliveriesCard() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const shops = useStaffShops();
  const isStaff = (shops.data ?? []).length > 0;
  const deliveries = useMyDeliveries(isStaff);
  if (!isStaff) return null;
  // Waiting for my answer, or on its way with me.
  const waiting = (deliveries.data ?? []).filter((entry) => ['packed', 'out_for_delivery'].includes(entry.status)).length;

  return (
    <Pressable
      onPress={() => openDeliveries()}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: `${colors.primary}0F`, borderColor: `${colors.primary}33`, transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
        <FontAwesome6 name="person-biking" size={15} color="#FFFFFF" solid />
      </LinearGradient>
      <View style={styles.flex}>
        <Text style={[styles.title, { color: colors.text }]}>{t('deliveries.cardTitle')}</Text>
        <Text style={[styles.text, { color: colors.textMuted }]} numberOfLines={1}>
          {t('deliveries.cardFor', { shops: (shops.data ?? []).map((shop) => shop.shopName).join(', ') })}
        </Text>
      </View>
      {waiting > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{waiting}</Text>
        </View>
      ) : null}
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.go}>
        <FontAwesome6 name="arrow-right" size={12} color="#FFFFFF" solid />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 20 },
  text: { ...typography.caption, fontSize: 12 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 11.5 },
  go: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
