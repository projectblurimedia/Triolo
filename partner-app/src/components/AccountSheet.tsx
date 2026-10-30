import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassBackdrop, GlassCard } from './Glass';
import { useAuthStore } from '@/state/authStore';
import { useStaffShops } from '@/hooks/useBusinessMutations';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0][0] : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

/** Who is signed in: name, number, and the shops they deliver for (for staff, who have no Profile tab). */
export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const shops = useStaffShops().data ?? [];
  if (!account) return null;

  const rows = [
    { icon: 'phone' as const, label: t('mainTabs.Profile.detailPhone'), value: account.mobileNumber },
    ...(account.email ? [{ icon: 'envelope' as const, label: t('mainTabs.Profile.detailEmail'), value: account.email }] : []),
    ...shops.map((shop) => ({
      icon: 'person-biking' as const,
      label: t('accountSheet.deliversFor'),
      value: t('accountSheet.shopLine', { shop: shop.shopName, owner: shop.ownerName }),
    })),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GlassBackdrop onPress={onClose} style={styles.overlay}>
        <GlassCard style={styles.sheet}>
          <View style={styles.head}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(account.fullName)}</Text>
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {account.fullName}
              </Text>
              <Text style={[styles.caption, { color: colors.textMuted }]}>
                {t(shops.length > 0 ? 'accountSheet.staffRole' : 'accountSheet.partnerRole')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={[styles.close, { borderColor: colors.border }]}>
              <FontAwesome6 name="xmark" size={14} color={colors.text} solid />
            </Pressable>
          </View>
          {rows.map((row, index) => (
            <View key={`${row.icon}-${index}`} style={[styles.row, { borderTopColor: colors.border }]}>
              <View style={[styles.rowIcon, { backgroundColor: `${colors.primary}14` }]}>
                <FontAwesome6 name={row.icon} size={13} color={colors.primary} solid />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{row.label}</Text>
                <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={2}>
                  {row.value}
                </Text>
              </View>
            </View>
          ))}
        </GlassCard>
      </GlassBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { borderRadius: 22, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 19 },
  name: { ...typography.subheading, fontFamily: fonts.semiBold },
  caption: { ...typography.caption, fontSize: 12 },
  close: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...typography.caption, fontSize: 11 },
  rowValue: { ...typography.body, fontFamily: fonts.medium, fontSize: 14 },
});
