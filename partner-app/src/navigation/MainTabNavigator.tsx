import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from '@/components/GradientHeader';
import { CustomTabBar } from '@/components/CustomTabBar';
import { SettingsMenuModal } from '@/components/SettingsMenuModal';
import { NotificationsModal } from '@/components/NotificationsModal';
import { HomeScreen } from '@/screens/main/HomeScreen';
import { BookingsScreen } from '@/screens/main/BookingsScreen';
import { EarningsScreen } from '@/screens/main/EarningsScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { useNotifications } from '@/hooks/useNotifications';
import { MainTabParamList } from './types';
import { ScreenBlurTarget } from './ScreenBlurTarget';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof FontAwesome6.glyphMap> = {
  Home: 'house',
  Bookings: 'calendar-check',
  Earnings: 'wallet',
  Profile: 'user',
};

/**
 * The verified-partner app shell — unlocked once a Worker/Business capability's
 * verificationStatus is 'verified' (see MainNavigator). Uses the same floating-pill
 * `CustomTabBar` as user-app (ported to `components/CustomTabBar.tsx` — see its own doc
 * comment), per explicit follow-up feedback that this app's tab bar should match the main
 * consumer app's rather than the plain default bottom-tabs bar. `CustomTabBar` renders its
 * own icons/labels-free layout, so `tabBarIcon`/tint/style options aren't needed here.
 *
 * Every tab's header carries a `bars` menu action opening `SettingsMenuModal` (language/
 * theme/logout) plus a `bell` action opening `NotificationsModal` (first slice of real,
 * polled in-app notifications — see that component's own doc comment) — both modals' own
 * visibility state lives here, one level above the individual tab screens, since every tab
 * shares the exact same menu/notification content (unlike user-app, where Home's drawer
 * differs from Profile's settings sheet) — so shared state here is simpler than four
 * per-screen header-wrapper components. The bell carries the live unread count as a small
 * badge (`GradientHeader`'s `HeaderAction.badgeCount`) via the same polled `useNotifications`
 * query `NotificationsModal` itself reads — one cache entry, so opening the modal never shows
 * a different count than what was on the badge a moment ago.
 */
export function MainTabNavigator() {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const { data: notifications } = useNotifications();

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        // Each tab screen is a blur target so the glass tab bar really blurs it on Android 12+.
        screenLayout={({ route, children }) => <ScreenBlurTarget routeKey={route.key}>{children}</ScreenBlurTarget>}
        screenOptions={({ route }) => {
          const name = route.name as keyof MainTabParamList;
          return {
            header: () => (
              <GradientHeader
                title={t(`mainTabs.${name}.title`)}
                subtitle={t(`mainTabs.${name}.subtitle`)}
                leadingIcon={TAB_ICONS[name]}
                actions={[
                  {
                    icon: 'bell',
                    accessibilityLabel: t('notifications.title'),
                    badgeCount: notifications?.unreadCount ?? 0,
                    onPress: () => setNotificationsVisible(true),
                  },
                  { icon: 'bars', accessibilityLabel: t('common.menu'), onPress: () => setMenuVisible(true) },
                ]}
              />
            ),
          };
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Bookings" component={BookingsScreen} />
        <Tab.Screen name="Earnings" component={EarningsScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>

      <SettingsMenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
    </>
  );
}
