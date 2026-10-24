import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SideMenuDrawer } from './SideMenuDrawer';
import { DrawerMenuItem } from './DrawerMenuItem';
import { SendListModal } from './SendListModal';
import { QuickOrderModal } from './QuickOrderModal';
import { NearbySearchModal } from './NearbySearchModal';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '@/navigation/types';
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
const PURPLE_GRADIENT = ['#7C3AED', '#A78BFA'] as const;
const TEAL_GRADIENT = ['#0891B2', '#22D3EE'] as const;

type BazaarMenuItemKey = 'quickOrder' | 'sendList' | 'nearbyShops' | 'myOrders' | 'favoriteShops';

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
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

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
            setActiveItem('quickOrder');
          }}
        />
        <DrawerMenuItem
          icon="paper-plane"
          gradient={PURPLE_GRADIENT}
          title={t('bazaarMenu.sendListTitle')}
          subtitle={t('bazaarMenu.sendListSubtitle')}
          onPress={() => {
            onClose();
            withLocation(() => setActiveItem('sendList'));
          }}
        />
        <DrawerMenuItem
          icon="location-dot"
          gradient={TEAL_GRADIENT}
          title={t('homeMenu.nearbyShopsTitle')}
          subtitle={t('homeMenu.nearbyShopsSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('nearbyShops');
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

      {/* Quick Order: the list to every matching shop nearby, first to accept gets it. */}
      <QuickOrderModal
        visible={activeItem === 'quickOrder'}
        onClose={() => setActiveItem(null)}
        onCreateList={() => {
          setActiveItem(null);
          navigation.navigate('PrepareList', { newList: Date.now() });
        }}
      />
      {/* Send your list to one shop you choose. */}
      <SendListModal visible={activeItem === 'sendList'} onClose={() => setActiveItem(null)} />
      <NearbySearchModal visible={activeItem === 'nearbyShops'} onClose={() => setActiveItem(null)} mode="business" />
      <MyOrdersModal visible={activeItem === 'myOrders'} onClose={() => setActiveItem(null)} />
      <FavoritesModal visible={activeItem === 'favoriteShops'} onClose={() => setActiveItem(null)} type="business" />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  sectionSpacing: { marginTop: 8 },
});
