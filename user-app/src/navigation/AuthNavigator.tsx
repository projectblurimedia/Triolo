import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from './types';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { OtpScreen } from '@/screens/auth/OtpScreen';
import { GradientHeader } from '@/components/GradientHeader';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: true, header: () => <GradientHeader title={t('auth.register')} showBack /> }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: true, header: () => <GradientHeader title={t('auth.login')} showBack /> }}
      />
      <Stack.Screen
        name="Otp"
        component={OtpScreen}
        options={{ headerShown: true, header: () => <GradientHeader title={t('auth.verifyOtp')} showBack /> }}
      />
    </Stack.Navigator>
  );
}
