import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SideMenuDrawer } from './SideMenuDrawer';
import { DrawerMenuItem } from './DrawerMenuItem';
import { ComingSoonModal } from './ComingSoonModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

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
  { key: 'favoriteShops', icon: 'star', gradient: PINK_GRADIENT },
];

/**
 * Bazaar tab's menu — same drawer redesign as `ServicesMenuDrawer` (replacing the earlier
 * `SideDockMenu` icon dock), with shop-domain equivalents: "Quick Order" mirrors "Quick
 * Book", "My Orders"/"Favorite Shops" mirror "My Bookings"/"Favorite Workers". None of
 * these screens exist yet (Business module remainder — Pending Module 5), so every item
 * opens a full-screen `ComingSoonModal` (same chrome as `NearbySearchModal`) instead of a
 * transient toast.
 */
export function BazaarMenuDrawer({ visible, onClose }: BazaarMenuDrawerProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [activeItem, setActiveItem] = useState<BazaarMenuItemKey | null>(null);

  const activeConfig = ITEMS.find((item) => item.key === activeItem);

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

      {activeConfig ? (
        <ComingSoonModal
          visible={activeItem !== null}
          onClose={() => setActiveItem(null)}
          gradient={activeConfig.gradient}
          icon={activeConfig.icon}
          title={t(`bazaarMenu.${activeConfig.key}Title`)}
          subtitle={t(`bazaarMenu.${activeConfig.key}Subtitle`)}
          comingSoonTitle={t('bazaarMenu.comingSoonTitle')}
          message={t(`bazaarMenu.${activeConfig.key}ComingSoonMessage`)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  sectionSpacing: { marginTop: 8 },
});
