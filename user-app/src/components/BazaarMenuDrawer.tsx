import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SideMenuDrawer } from './SideMenuDrawer';
import { DrawerMenuItem } from './DrawerMenuItem';
import { SendListModal } from './SendListModal';
import { MyOrdersModal } from './MyOrdersModal';
import { FavoritesModal } from './FavoritesModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { withLocation } from '@/utils/ensureLocationOn';

interface BazaarMenuDrawerProps {
  visible: boolean;
  onClose: () => void;
}

// Same distinct-per-item color rationale as ServicesMenuDrawer — blue for the "quick
// action" item, green for tracking, pink for favorites. Deliberately no orange/amber —
// that stays reserved for the Business capability identity (SHOP_GRADIENT), never this
// tab's own chrome/menu, per the existing convention and explicit follow-up instruction.
const BLUE_GRADIENT = headerGradient;
const GREEN_GRADIENT = ['#16A34A', '#4ADE80'] as const;
const PINK_GRADIENT = ['#DB2777', '#F472B6'] as const;

type BazaarMenuItemKey = 'quickOrder' | 'myOrders' | 'favoriteShops';

const ITEMS: {
  key: BazaarMenuItemKey;
  icon: React.ComponentProps<typeof DrawerMenuItem>['icon'];
  gradient: readonly [string, string];
}[] = [
  { key: 'quickOrder', icon: 'bag-shopping', gradient: BLUE_GRADIENT },
  { key: 'myOrders', icon: 'receipt', gradient: GREEN_GRADIENT },
  { key: 'favoriteShops', icon: 'heart', gradient: PINK_GRADIENT },
];

/**
 * Bazaar tab's menu — same drawer redesign as `ServicesMenuDrawer` (replacing the earlier
 * `SideDockMenu` icon dock), with shop-domain equivalents: Quick Order (send the prepared list
 * to a nearby shop), My Orders and Favorite Shops.
 */
export function BazaarMenuDrawer({ visible, onClose }: BazaarMenuDrawerProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [activeItem, setActiveItem] = useState<BazaarMenuItemKey | null>(null);

  return (
    <>
      <SideMenuDrawer
        visible={visible}
        onClose={onClose}
        gradient={headerGradient}
        icon="store"
        title={t('bazaarMenu.title')}
        subtitle={t('bazaarMenu.subtitle')}
      >
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('bazaarMenu.shopSection')}</Text>
        <DrawerMenuItem
          icon={ITEMS[0].icon}
          gradient={ITEMS[0].gradient}
          title={t('bazaarMenu.quickOrderTitle')}
          subtitle={t('bazaarMenu.quickOrderSubtitle')}
          onPress={() => {
            onClose();
            withLocation(() => setActiveItem('quickOrder'));
          }}
        />

        <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.textMuted }]}>
          {t('bazaarMenu.manageSection')}
        </Text>
        <DrawerMenuItem
          icon={ITEMS[1].icon}
          gradient={ITEMS[1].gradient}
          title={t('bazaarMenu.myOrdersTitle')}
          subtitle={t('bazaarMenu.myOrdersSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('myOrders');
          }}
        />
        <DrawerMenuItem
          icon={ITEMS[2].icon}
          gradient={ITEMS[2].gradient}
          title={t('bazaarMenu.favoriteShopsTitle')}
          subtitle={t('bazaarMenu.favoriteShopsSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('favoriteShops');
          }}
        />
      </SideMenuDrawer>

      {/* Quick Order sends the prepared list to a nearby shop (Prepare List → shop packs it). */}
      <SendListModal visible={activeItem === 'quickOrder'} onClose={() => setActiveItem(null)} />
      <MyOrdersModal visible={activeItem === 'myOrders'} onClose={() => setActiveItem(null)} />
      <FavoritesModal visible={activeItem === 'favoriteShops'} onClose={() => setActiveItem(null)} type="business" />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  sectionSpacing: { marginTop: 8 },
});
