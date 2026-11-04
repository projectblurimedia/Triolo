import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CardFill, KindChips, MetaLine, RatedAvatar, miniCardStyles, useCardChrome } from './WorkerMiniCard';
import { BusinessNearbyResult } from '@/services/businessesService';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { colors as brandColors, useThemeColors } from '@/theme';
import { shopKindLabels } from '@/utils/kindLabels';
import { FullText } from '@/components/FullText';

/** Compact shop card for horizontal carousels (Home's marketplace row, Bazaar). */
export function ShopMiniCard({ shop, onPress }: { shop: BusinessNearbyResult; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const chrome = useCardChrome();
  const categories = shopKindLabels(t, shop).join(', ');

  return (
    <Pressable onPress={onPress} style={[miniCardStyles.card, chrome]}>
      <CardFill />
      <RatedAvatar
        photoUrl={shop.profilePhotoUrl}
        name={shop.shopName}
        size={56}
        seal={{ kind: 'business', id: shop.id }}
        average={shop.ratingAverage}
        count={shop.ratingCount}
      />
      <FullText style={[miniCardStyles.name, { color: colors.text }]} numberOfLines={1}>
        {shop.shopName}
      </FullText>
      <KindChips kinds={shopKindLabels(t, shop)} center />
      <MetaLine
        parts={[
          { text: formatDistanceValue(shop.distanceMeters), color: colors.primary, strong: true, icon: 'location-arrow' },
          shop.deliveryAvailable
            ? { text: t('home.delivery'), color: brandColors.success, strong: true }
            : { text: t('home.pickup') },
        ]}
      />
    </Pressable>
  );
}
