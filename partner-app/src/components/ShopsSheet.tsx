import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassBackdrop, GlassCard } from './Glass';
import { SmartImage } from './SmartImage';
import { VerificationBadge } from './VerificationBadge';
import { BusinessProfile } from '@/services/businessesService';
import { formatAddress } from '@/utils/formatAddress';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

/**
 * Every shop of the partner in one sheet (Profile shows them as one card when there are two
 * or more, like job posts). Tapping a shop opens its profile; Add another starts a new one.
 */
export function ShopsSheet({
  visible,
  shops,
  canAdd,
  hint,
  onClose,
  onOpen,
  onAdd,
}: {
  visible: boolean;
  shops: BusinessProfile[];
  canAdd: boolean;
  /** The line under the title (default: tap one to open it). */
  hint?: string;
  onClose: () => void;
  onOpen: (shop: BusinessProfile) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GlassBackdrop onPress={onClose} style={styles.overlay}>
        <GlassCard style={styles.sheet}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{t('shops.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{hint ?? t('shops.sheetHint')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={[styles.close, { borderColor: colors.border }]}>
              <FontAwesome6 name="xmark" size={14} color={colors.text} solid />
            </Pressable>
          </View>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {shops.map((shop, index) => (
              <View key={shop.id}>
                <Text style={[styles.number, { color: colors.primary }]}>{t('shops.shopNumber', { n: index + 1 })}</Text>
                <ShopRow shop={shop} onPress={() => onOpen(shop)} />
              </View>
            ))}
          </ScrollView>
          {canAdd ? (
            <Pressable
              onPress={onAdd}
              style={({ pressed }) => [styles.add, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}0A`, opacity: pressed ? 0.85 : 1 }]}
            >
              <FontAwesome6 name="plus" size={13} color={colors.primary} solid />
              <Text style={[styles.addText, { color: colors.primary }]}>{t('shops.addAnother')}</Text>
            </Pressable>
          ) : null}
        </GlassCard>
      </GlassBackdrop>
    </Modal>
  );
}

/** One shop: its photo (or the store icon), name, place, and its status when not verified. */
export function ShopRow({ shop, onPress }: { shop: BusinessProfile; onPress: () => void }) {
  const { colors } = useThemeColors();
  const place = formatAddress(shop);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}
    >
      <ShopAvatar shop={shop} size={40} />
      <View style={styles.flex}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
          {shop.shopName}
        </Text>
        {place ? (
          <Text style={[styles.rowPlace, { color: colors.textMuted }]} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
      {shop.verificationStatus !== 'verified' ? <VerificationBadge status={shop.verificationStatus} /> : null}
      <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} solid />
    </Pressable>
  );
}

export function ShopAvatar({ shop, size, ring }: { shop: BusinessProfile; size: number; ring?: string }) {
  const box = { width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 2 : 0, borderColor: ring };
  return shop.profilePhotoUrl ? (
    <SmartImage source={{ uri: shop.profilePhotoUrl }} style={box} />
  ) : (
    <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[box, styles.iconBox]}>
      <FontAwesome6 name="store" size={size * 0.36} color="#FFFFFF" solid />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { borderRadius: 22, padding: 14, maxHeight: '80%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  subtitle: { ...typography.caption, fontSize: 12 },
  close: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0 },
  number: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 10 },
  rowName: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14.5 },
  rowPlace: { ...typography.caption, fontSize: 11.5 },
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4 },
  addText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
});
