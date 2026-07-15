import React from 'react';
import { Platform, Pressable, View } from 'react-native';
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
// active vs. inactive is shown via color only, not icon shape.
const ICONS: Record<keyof MainTabParamList, keyof typeof FontAwesome5.glyphMap> = {
  Home: 'home',
  Search: 'search',
  Bazaar: 'store',
  Profile: 'user',
};

const TAB_BAR_RADIUS = 30;

export function AppNavigator() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const titles: Record<keyof MainTabParamList, string> = {
    Home: t('tabs.home'),
    Search: t('tabs.search'),
    Bazaar: t('tabs.bazaar'),
    Profile: t('tabs.profile'),
  };

  const subtitles: Partial<Record<keyof MainTabParamList, string>> = {
    Search: t('search.tagline'),
    Bazaar: t('bazaar.tagline'),
    Profile: t('profile.tagline'),
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => (
          <GradientHeader
            title={titles[route.name as keyof MainTabParamList]}
            subtitle={subtitles[route.name as keyof MainTabParamList]}
            leadingIcon={ICONS[route.name as keyof MainTabParamList]}
          />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 13, marginTop: 4 },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderTopLeftRadius: TAB_BAR_RADIUS,
          borderTopRightRadius: TAB_BAR_RADIUS,
          overflow: 'hidden',
          elevation: 16,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: -4 },
          shadowRadius: 12,
        },
        // Custom background so the top edge can carry a gradient line (a native border
        // can't be a gradient) whose own corners are rounded to match the tab bar's,
        // instead of a flat strip that gets hard-clipped where the corner curve starts.
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <LinearGradient
              colors={headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 4,
                borderTopLeftRadius: TAB_BAR_RADIUS,
                borderTopRightRadius: TAB_BAR_RADIUS,
              }}
            />
          </View>
        ),
        // Default tab button shows an Android ripple / iOS opacity dim on press —
        // replaced with a plain Pressable so selecting a tab shows no press background.
        tabBarButton: ({ ref: _ref, ...rest }) => <Pressable {...rest} android_ripple={{ color: 'transparent' }} />,
        tabBarIcon: ({ focused, size }) => {
          const icon = ICONS[route.name as keyof MainTabParamList];
          return <FontAwesome5 name={icon} size={size - 2} color={focused ? colors.primary : colors.textMuted} solid />;
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
              subtitle={t('home.tagline')}
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
