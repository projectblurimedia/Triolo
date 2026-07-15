import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { MainTabParamList } from './types';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { SearchScreen } from '@/screens/search/SearchScreen';
import { ShoppifyScreen } from '@/screens/shoppify/ShoppifyScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { GradientHeader } from '@/components/GradientHeader';
import { colors, fonts } from '@/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Search: { active: 'search', inactive: 'search-outline' },
  Shoppify: { active: 'storefront', inactive: 'storefront-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function AppNavigator() {
  const { t } = useTranslation();

  const titles: Record<keyof MainTabParamList, string> = {
    Home: t('tabs.home'),
    Search: t('tabs.search'),
    Shoppify: t('tabs.shoppify'),
    Profile: t('tabs.profile'),
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <GradientHeader title={titles[route.name as keyof MainTabParamList]} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          backgroundColor: colors.background,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icon = ICONS[route.name as keyof MainTabParamList];
          return <Ionicons name={focused ? icon.active : icon.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: titles.Home }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarLabel: titles.Search }} />
      <Tab.Screen name="Shoppify" component={ShoppifyScreen} options={{ tabBarLabel: titles.Shoppify }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: titles.Profile }} />
    </Tab.Navigator>
  );
}
