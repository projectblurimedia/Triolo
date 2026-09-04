import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MainStackParamList } from './types';
import { ChooseCapabilityScreen } from '@/screens/capability/ChooseCapabilityScreen';
import { WorkerRegistrationScreen } from '@/screens/capability/WorkerRegistrationScreen';
import { BusinessRegistrationScreen } from '@/screens/capability/BusinessRegistrationScreen';
import { MyInfoScreen } from '@/screens/capability/MyInfoScreen';
import { GradientHeader } from '@/components/GradientHeader';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * A plain stack, not tabs — this app's whole surface is registration + a status screen,
 * not a multi-section product (unlike user-app's bottom-tab shell).
 */
export function MainNavigator() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChooseCapability" component={ChooseCapabilityScreen} />
      <Stack.Screen
        name="WorkerRegistration"
        component={WorkerRegistrationScreen}
        options={{ headerShown: true, header: () => <GradientHeader title={t('workerProfile.title')} showBack /> }}
      />
      <Stack.Screen
        name="BusinessRegistration"
        component={BusinessRegistrationScreen}
        options={{ headerShown: true, header: () => <GradientHeader title={t('businessProfile.title')} showBack /> }}
      />
      <Stack.Screen
        name="MyInfo"
        component={MyInfoScreen}
        options={{ headerShown: true, header: () => <GradientHeader title={t('myInfo.title')} showBack /> }}
      />
    </Stack.Navigator>
  );
}
