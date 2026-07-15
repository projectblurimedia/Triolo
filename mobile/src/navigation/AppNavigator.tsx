import React from 'react';
import { Platform, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { MainTabParamList } from './types';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { SearchScreen } from '@/screens/search/SearchScreen';
import { BazaarScreen } from '@/screens/bazaar/BazaarScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { GradientHeader } from '@/components/GradientHeader';
import { fonts, headerGradient, useThemeColors } from '@/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

// FontAwesome5's free tier only ships these as solid glyphs (no outline variant) —
// active vs. inactive is differentiated by the gradient pill below, not icon shape.
const ICONS: Record<keyof MainTabParamList, keyof typeof FontAwesome5.glyphMap> = {
  Home: 'home',
  Search: 'search',
  Bazaar: 'store',
  Profile: 'user',
};

const ACTIVE_PILL_SIZE = 40;

export function AppNavigator() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const titles: Record<keyof MainTabParamList, string> = {
    Home: t('tabs.home'),
    Search: t('tabs.search'),
    Bazaar: t('tabs.bazaar'),
    Profile: t('tabs.profile'),
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => (
          <GradientHeader
            title={titles[route.name as keyof MainTabParamList]}
            leadingIcon={ICONS[route.name as keyof MainTabParamList]}
          />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 92 : 72,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 30 : 14,
          backgroundColor: colors.background,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          elevation: 16,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: -4 },
          shadowRadius: 12,
        },
        tabBarIcon: ({ focused, size }) => {
          const icon = ICONS[route.name as keyof MainTabParamList];
          if (focused) {
            return (
              <LinearGradient
                colors={headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: ACTIVE_PILL_SIZE,
                  height: ACTIVE_PILL_SIZE,
                  borderRadius: ACTIVE_PILL_SIZE / 2,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <FontAwesome5 name={icon} size={size - 5} color={colors.white} solid />
              </LinearGradient>
            );
          }
          return (
            <View style={{ width: ACTIVE_PILL_SIZE, height: ACTIVE_PILL_SIZE, justifyContent: 'center', alignItems: 'center' }}>
              <FontAwesome5 name={icon} size={size - 5} color={colors.textMuted} solid />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: titles.Home,
          // Home shows the app brand (with a decorative logo icon) instead of the tab
          // title, plus quick actions. Notifications/Messages/Menu have no destination
          // yet — Notifications and in-app chat aren't built (see .cloud/project-context.md).
          header: () => (
            <GradientHeader
              title={t('common.appName')}
              leadingIcon="compass"
              actions={[
                { icon: 'bell', accessibilityLabel: t('home.notifications') },
                { icon: 'comment-dots', accessibilityLabel: t('home.messages') },
                { icon: 'bars', accessibilityLabel: t('home.menu') },
              ]}
            />
          ),
        }}
      />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarLabel: titles.Search }} />
      <Tab.Screen name="Bazaar" component={BazaarScreen} options={{ tabBarLabel: titles.Bazaar }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: titles.Profile }} />
    </Tab.Navigator>
  );
}
