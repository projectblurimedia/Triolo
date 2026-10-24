import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SideMenuDrawer } from './SideMenuDrawer';
import { DrawerMenuItem } from './DrawerMenuItem';
import { NearbySearchModal } from './NearbySearchModal';
import { FavoritesModal } from './FavoritesModal';
import { QuickBookModal } from './QuickBookModal';
import { YourProblemsModal } from './YourProblemsModal';
import { MyBookingsModal } from './MyBookingsModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { HireStaffModal } from './HireStaffModal';

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
const TEAL_GRADIENT = ['#0D9488', '#2DD4BF'] as const;

type ServicesMenuItemKey = 'quickBook' | 'yourProblems' | 'hireStaff' | 'myBookings' | 'favoriteWorkers' | 'nearbyWorkers';

const ITEMS: {
  key: ServicesMenuItemKey;
  icon: React.ComponentProps<typeof DrawerMenuItem>['icon'];
  gradient: readonly [string, string];
}[] = [
  { key: 'quickBook', icon: 'bolt', gradient: BLUE_GRADIENT },
  { key: 'yourProblems', icon: 'clipboard-list', gradient: PURPLE_GRADIENT },
  { key: 'myBookings', icon: 'calendar-check', gradient: GREEN_GRADIENT },
  { key: 'favoriteWorkers', icon: 'heart', gradient: PINK_GRADIENT },
];

/**
 * Services tab's menu — replaced the earlier compact `SideDockMenu` icon dock (Filters/
 * Sort/Favorites/History) with a full drawer matching Home's own, per explicit feedback
 * that this tab's menu should look and work like Home's. "Quick Book" (search/book a
 * worker directly) and "Your Problems" (post a non-emergency issue so nearby workers
 * can pick it up — the broadcast-style discovery already planned in
 * .cloud/architecture.md's Search Architecture section) are the two things a user actually
 * comes to this tab to do; "My Bookings"/"Favorite Workers" round out the tab's own
 * management surface. Every item opens its own full-screen screen.
 */
export function ServicesMenuDrawer({ visible, onClose }: ServicesMenuDrawerProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [activeItem, setActiveItem] = useState<ServicesMenuItemKey | null>(null);

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
          title={t('servicesMenu.yourProblemsTitle')}
          subtitle={t('servicesMenu.yourProblemsSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('yourProblems');
          }}
        />
        <DrawerMenuItem
          icon="user-tie"
          gradient={TEAL_GRADIENT}
          title={t('hireStaff.menuTitle')}
          subtitle={t('hireStaff.menuSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('hireStaff');
          }}
        />
        <DrawerMenuItem
          icon="location-dot"
          gradient={['#2563EB', '#60A5FA']}
          title={t('homeMenu.nearbyWorkersTitle')}
          subtitle={t('homeMenu.nearbyWorkersSubtitle')}
          onPress={() => {
            onClose();
            setActiveItem('nearbyWorkers');
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

      <QuickBookModal visible={activeItem === 'quickBook'} onClose={() => setActiveItem(null)} />
      <YourProblemsModal visible={activeItem === 'yourProblems'} onClose={() => setActiveItem(null)} />
      <HireStaffModal visible={activeItem === 'hireStaff'} onClose={() => setActiveItem(null)} />
      <NearbySearchModal visible={activeItem === 'nearbyWorkers'} onClose={() => setActiveItem(null)} mode="worker" />
      <MyBookingsModal visible={activeItem === 'myBookings'} onClose={() => setActiveItem(null)} />

      <FavoritesModal visible={activeItem === 'favoriteWorkers'} onClose={() => setActiveItem(null)} type="worker" />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  sectionSpacing: { marginTop: 8 },
});
