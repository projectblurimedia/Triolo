import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MainStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { ChooseCapabilityScreen } from '@/screens/capability/ChooseCapabilityScreen';
import { WorkerRegistrationScreen } from '@/screens/capability/WorkerRegistrationScreen';
import { BusinessRegistrationScreen } from '@/screens/capability/BusinessRegistrationScreen';
import { MyInfoScreen } from '@/screens/capability/MyInfoScreen';
import { GradientHeader } from '@/components/GradientHeader';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useThemeColors } from '@/theme';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Registration flow (ChooseCapability → Worker/BusinessRegistration → MyInfo) plus, once
 * either capability is `verified`, the real app shell (MainTabs — Home/Search/Profile). Both
 * live in the same stack so MainTabs' Profile tab can push Worker/BusinessRegistration/MyInfo
 * on top of itself to add the other capability or view details, rather than needing a second
 * top-level navigator. `initialRouteName` is decided once, from the verification status
 * already known by the time this Stack.Navigator itself mounts (the loading state below
 * blocks mounting it until then), so it never needs to change after the fact — a capability
 * getting verified while the app is open just means the next cold start lands on MainTabs.
 */
export function MainNavigator() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const workerProfile = useMyWorkerProfile();
  const businessProfile = useMyBusinessProfile();

  if (workerProfile.isLoading || businessProfile.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <LoadingIndicator color={colors.primary} />
      </View>
    );
  }

  const hasVerifiedCapability =
    workerProfile.data?.verificationStatus === 'verified' || businessProfile.data?.verificationStatus === 'verified';

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={hasVerifiedCapability ? 'MainTabs' : 'ChooseCapability'}
    >
      <Stack.Screen name="ChooseCapability" component={ChooseCapabilityScreen} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="WorkerRegistration"
        component={WorkerRegistrationScreen}
        options={({ route }) => ({
          headerShown: true,
          header: () => (
            <GradientHeader title={t(route.params?.profile ? 'workerProfile.editTitle' : 'workerProfile.title')} showBack />
          ),
        })}
      />
      <Stack.Screen
        name="BusinessRegistration"
        component={BusinessRegistrationScreen}
        options={({ route }) => ({
          headerShown: true,
          header: () => (
            <GradientHeader title={t(route.params?.profile ? 'businessProfile.editTitle' : 'businessProfile.title')} showBack />
          ),
        })}
      />
      {/* MyInfoScreen renders its own GradientHeader (with a pen edit action it alone has
          the fetched profile data for) rather than a navigator-level header — same
          wrapper-component pattern user-app uses for any screen needing header-triggered
          state (see .cloud/architecture.md's "Home, Profile, Services, and Bazaar are
          exceptions to the shared header"). */}
      <Stack.Screen name="MyInfo" component={MyInfoScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
