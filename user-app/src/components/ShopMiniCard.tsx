import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar, miniCardStyles } from './WorkerMiniCard';
import { RatingStars } from './RatingStars';
import { BusinessNearbyResult } from '@/services/businessesService';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

/** Compact shop card for horizontal carousels (Home's marketplace row). */
export function ShopMiniCard({ shop, onPress }: { shop: BusinessNearbyResult; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const categories = shop.shopCategories
    .filter((key) => key !== 'other')
    .map((key) => t(`businessProfile.categories.${key}`))
    .join(', ');

  return (
    <Pressable onPress={onPress} style={[miniCardStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Avatar photoUrl={shop.shopPhotoUrls[0] ?? shop.profilePhotoUrl} name={shop.shopName} size={56} />
      <Text style={[miniCardStyles.name, { color: colors.text }]} numberOfLines={1}>
        {shop.shopName}
      </Text>
      <Text style={[miniCardStyles.sub, { color: colors.textMuted }]} numberOfLines={1}>
        {categories}
      </Text>
      <RatingStars average={shop.ratingAverage} count={shop.ratingCount} />
      {shop.deliveryAvailable ? (
        <View style={[styles.deliveryPill, { backgroundColor: `${brandColors.success}1A` }]}>
          <FontAwesome6 name="truck" size={9} color={brandColors.success} solid />
          <Text style={[styles.deliveryText, { color: brandColors.success }]}>{t('home.delivery')}</Text>
        </View>
      ) : (
        <View style={[styles.deliveryPill, { backgroundColor: `${colors.textMuted}14` }]}>
          <FontAwesome6 name="store" size={9} color={colors.textMuted} solid />
          <Text style={[styles.deliveryText, { color: colors.textMuted }]}>{t('home.pickup')}</Text>
        </View>
      )}
      <View style={miniCardStyles.meta}>
        <FontAwesome6 name="location-arrow" size={10} color={colors.primary} solid />
        <Text style={[miniCardStyles.metaStrong, { color: colors.primary }]}>{formatDistanceValue(shop.distanceMeters)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  deliveryPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  deliveryText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
});
