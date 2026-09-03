import React, { useRef } from 'react';
import { View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { MainTabParamList } from './types';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { ServicesScreen } from '@/screens/services/ServicesScreen';
import { BazaarScreen } from '@/screens/bazaar/BazaarScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { GradientHeader } from '@/components/GradientHeader';
import { HomeHeader } from '@/components/HomeHeader';
import { ServicesHeader } from '@/components/ServicesHeader';
import { BazaarHeader } from '@/components/BazaarHeader';
import { ProfileHeader } from '@/components/ProfileHeader';
import { CustomTabBar } from '@/components/CustomTabBar';

const Tab = createBottomTabNavigator<MainTabParamList>();

// FontAwesome6's free tier only ships these as solid glyphs (no outline variant) —
// active vs. inactive is shown via color only, not icon shape.
const ICONS: Record<keyof MainTabParamList, keyof typeof FontAwesome6.glyphMap> = {
  Home: 'house',
  Services: 'screwdriver-wrench',
  Bazaar: 'store',
  Profile: 'user',
};

export function AppNavigator() {
  const { t } = useTranslation();
  // CustomTabBar's glass effect (expo-blur's BlurView, Android's dimezisBlurViewSdk31Plus
  // method) needs a ref to the content it's blurring — BlurTargetView wraps that content
  // (the whole Tab.Navigator, screens included) and the ref is handed to BlurView via its
  // `blurTarget` prop, not `ref` (BlurTargetView owns the `ref`, BlurView just reads it).
  const blurTargetRef = useRef<View>(null);

  const titles: Record<keyof MainTabParamList, string> = {
    Home: t('tabs.home'),
    Services: t('tabs.services'),
    Bazaar: t('tabs.bazaar'),
    Profile: t('tabs.profile'),
  };

  const subtitles: Partial<Record<keyof MainTabParamList, string>> = {
    Services: t('services.tagline'),
    Bazaar: t('bazaar.tagline'),
    Profile: t('profile.tagline'),
  };

  return (
    <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} blurTarget={blurTargetRef} />}
        screenOptions={({ route }) => ({
          header: () => (
            <GradientHeader
              title={titles[route.name as keyof MainTabParamList]}
              subtitle={subtitles[route.name as keyof MainTabParamList]}
              leadingIcon={ICONS[route.name as keyof MainTabParamList]}
            />
          ),
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            // Home shows the app brand (with a decorative logo icon) instead of the tab
            // title, plus quick actions. Notifications has no destination yet — the
            // Notifications module isn't built (see .cloud/project-context.md). The menu
            // icon opens a drawer with Worker/Business onboarding entry points — needs
            // its own local state (drawer visibility), which a stateless header render
            // function here can't hold, so it's a wrapper component (HomeHeader) instead,
            // same pattern as ProfileHeader.
            header: () => <HomeHeader title={t('common.appName')} subtitle={t('home.tagline')} />,
          }}
        />
        <Tab.Screen
          name="Services"
          component={ServicesScreen}
          options={{
            header: () => <ServicesHeader title={titles.Services} subtitle={subtitles.Services} />,
          }}
        />
        <Tab.Screen
          name="Bazaar"
          component={BazaarScreen}
          options={{
            header: () => <BazaarHeader title={titles.Bazaar} subtitle={subtitles.Bazaar} />,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            // Profile's menu icon opens language/theme/logout in a modal instead of
            // showing them inline — keeps the main screen focused on the account itself.
            header: () => <ProfileHeader title={titles.Profile} subtitle={subtitles.Profile} />,
          }}
        />
      </Tab.Navigator>
    </BlurTargetView>
  );
}
