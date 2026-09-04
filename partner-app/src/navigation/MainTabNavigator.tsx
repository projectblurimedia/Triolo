import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from '@/components/GradientHeader';
import { CustomTabBar } from '@/components/CustomTabBar';
import { SettingsMenuModal } from '@/components/SettingsMenuModal';
import { HomeScreen } from '@/screens/main/HomeScreen';
import { BookingsScreen } from '@/screens/main/BookingsScreen';
import { EarningsScreen } from '@/screens/main/EarningsScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { MainTabParamList } from './types';

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
 * theme/logout) — the menu-visibility state lives here, one level above the individual tab
 * screens, since every tab shares the exact same menu content (unlike user-app, where Home's
 * drawer differs from Profile's settings sheet) — so one shared piece of state is simpler
 * than four per-screen header-wrapper components.
 */
export function MainTabNavigator() {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={({ route }) => {
          const name = route.name as keyof MainTabParamList;
          return {
            header: () => (
              <GradientHeader
                title={t(`mainTabs.${name}.title`)}
                subtitle={t(`mainTabs.${name}.subtitle`)}
                leadingIcon={TAB_ICONS[name]}
                actions={[{ icon: 'bars', accessibilityLabel: t('common.menu'), onPress: () => setMenuVisible(true) }]}
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
    </>
  );
}
