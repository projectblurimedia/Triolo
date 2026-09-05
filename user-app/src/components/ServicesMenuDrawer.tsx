import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SideMenuDrawer } from './SideMenuDrawer';
import { DrawerMenuItem } from './DrawerMenuItem';
import { ComingSoonModal } from './ComingSoonModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

interface ServicesMenuDrawerProps {
  visible: boolean;
  onClose: () => void;
}

// Each item gets its own distinct, colorful gradient instead of repeating the same brand
// blue on every icon — blue stays for the "quick action" item, and the rest use their own
// color so the list reads as a set of different things you can do, not one flat block.
// Deliberately no orange/amber anywhere here — that stays reserved for the Business
// capability identity (SHOP_GRADIENT) per explicit instruction not to use it elsewhere.
const BLUE_GRADIENT = headerGradient;
const PURPLE_GRADIENT = ['#7C3AED', '#A78BFA'] as const;
const GREEN_GRADIENT = ['#16A34A', '#4ADE80'] as const;
const PINK_GRADIENT = ['#DB2777', '#F472B6'] as const;

type ServicesMenuItemKey = 'quickBook' | 'postProblem' | 'myBookings' | 'favoriteWorkers';

const ITEMS: {
  key: ServicesMenuItemKey;
  icon: React.ComponentProps<typeof DrawerMenuItem>['icon'];
  gradient: readonly [string, string];
}[] = [
  { key: 'quickBook', icon: 'bolt', gradient: BLUE_GRADIENT },
  { key: 'postProblem', icon: 'triangle-exclamation', gradient: PURPLE_GRADIENT },
  { key: 'myBookings', icon: 'calendar-check', gradient: GREEN_GRADIENT },
  { key: 'favoriteWorkers', icon: 'star', gradient: PINK_GRADIENT },
];

/**
 * Services tab's menu — replaced the earlier compact `SideDockMenu` icon dock (Filters/
 * Sort/Favorites/History) with a full drawer matching Home's own, per explicit feedback
 * that this tab's menu should look and work like Home's. "Quick Book" (search/book a
 * worker directly) and "Post a Problem" (describe a non-emergency issue so nearby workers
 * can pick it up — the broadcast-style discovery already planned in
 * .cloud/architecture.md's Search Architecture section) are the two things a user actually
 * comes to this tab to do; "My Bookings"/"Favorite Workers" round out the tab's own
 * management surface. None of these screens exist yet (Worker module remainder — Pending
 * Module 4), so every item opens a full-screen `ComingSoonModal` (same chrome as
 * `NearbySearchModal`) instead of a transient toast, per explicit feedback that tapping a
 * menu item should feel like opening a real screen.
 */
export function ServicesMenuDrawer({ visible, onClose }: ServicesMenuDrawerProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [activeItem, setActiveItem] = useState<ServicesMenuItemKey | null>(null);

  const activeConfig = ITEMS.find((item) => item.key === activeItem);

  return (
    <>
      <SideMenuDrawer
        visible={visible}
        onClose={onClose}
        gradient={headerGradient}
        icon="screwdriver-wrench"
        title={t('servicesMenu.title')}
        subtitle={t('servicesMenu.subtitle')}
      >
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('servicesMenu.getHelpSection')}</Text>
        <DrawerMenuItem
          icon={ITEMS[0].icon}
          gradient={ITEMS[0].gradient}
          title={t('servicesMenu.quickBookTitle')}
          subtitle={t('servicesMenu.quickBookSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('quickBook');
          }}
        />
        <DrawerMenuItem
          icon={ITEMS[1].icon}
          gradient={ITEMS[1].gradient}
          title={t('servicesMenu.postProblemTitle')}
          subtitle={t('servicesMenu.postProblemSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('postProblem');
          }}
        />

        <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.textMuted }]}>
          {t('servicesMenu.manageSection')}
        </Text>
        <DrawerMenuItem
          icon={ITEMS[2].icon}
          gradient={ITEMS[2].gradient}
          title={t('servicesMenu.myBookingsTitle')}
          subtitle={t('servicesMenu.myBookingsSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('myBookings');
          }}
        />
        <DrawerMenuItem
          icon={ITEMS[3].icon}
          gradient={ITEMS[3].gradient}
          title={t('servicesMenu.favoriteWorkersTitle')}
          subtitle={t('servicesMenu.favoriteWorkersSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('favoriteWorkers');
          }}
        />
      </SideMenuDrawer>

      {activeConfig ? (
        <ComingSoonModal
          visible={activeItem !== null}
          onClose={() => setActiveItem(null)}
          gradient={activeConfig.gradient}
          icon={activeConfig.icon}
          title={t(`servicesMenu.${activeConfig.key}Title`)}
          subtitle={t(`servicesMenu.${activeConfig.key}Subtitle`)}
          comingSoonTitle={t('servicesMenu.comingSoonTitle')}
          message={t(`servicesMenu.${activeConfig.key}ComingSoonMessage`)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  sectionSpacing: { marginTop: 8 },
});
