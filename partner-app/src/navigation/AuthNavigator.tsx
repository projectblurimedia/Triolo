import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from './types';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { RegisterWorkerScreen } from '@/screens/auth/RegisterWorkerScreen';
import { RegisterBusinessScreen } from '@/screens/auth/RegisterBusinessScreen';
import { RegisterJobSeekerScreen } from '@/screens/auth/RegisterJobSeekerScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { OtpScreen } from '@/screens/auth/OtpScreen';
import { RegisterHeader } from '@/components/RegisterHeader';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen
        name="RegisterWorker"
        component={RegisterWorkerScreen}
        options={{
          headerShown: true,
          header: () => <RegisterHeader title={t('workerProfile.title')} subtitle={t('auth.registerWorkerHeaderSubtitle')} />,
        }}
      />
      <Stack.Screen
        name="RegisterBusiness"
        component={RegisterBusinessScreen}
        options={{
          headerShown: true,
          header: () => <RegisterHeader title={t('businessProfile.title')} subtitle={t('auth.registerShopHeaderSubtitle')} />,
        }}
      />
      <Stack.Screen
        name="RegisterJobSeeker"
        component={RegisterJobSeekerScreen}
        options={{
          headerShown: true,
          header: () => <RegisterHeader title={t('jobPost.title')} subtitle={t('auth.registerJobHeaderSubtitle')} />,
        }}
      />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
    </Stack.Navigator>
  );
}
