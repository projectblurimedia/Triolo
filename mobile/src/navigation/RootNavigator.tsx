import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '@/state/authStore';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';

export function RootNavigator() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return <NavigationContainer>{accessToken ? <AppNavigator /> : <AuthNavigator />}</NavigationContainer>;
}
