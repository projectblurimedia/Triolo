import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from './types';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { RegisterWorkerScreen } from '@/screens/auth/RegisterWorkerScreen';
import { RegisterBusinessScreen } from '@/screens/auth/RegisterBusinessScreen';
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
        name="RegisterWorker"
        component={RegisterWorkerScreen}
        options={{ headerShown: true, header: () => <GradientHeader title={t('workerProfile.title')} showBack /> }}
      />
      <Stack.Screen
        name="RegisterBusiness"
        component={RegisterBusinessScreen}
        options={{ headerShown: true, header: () => <GradientHeader title={t('businessProfile.title')} showBack /> }}
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
