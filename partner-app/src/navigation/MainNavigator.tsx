import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { Button } from '@/components/Button';
import { fonts, typography, useThemeColors } from '@/theme';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Registration flow (ChooseCapability → Worker/BusinessRegistration → MyInfo) plus, once
 * either capability is `verified`, the real app shell (MainTabs — Home/Search/Profile). Both
 * live in the same stack so MainTabs' Profile tab can push Worker/BusinessRegistration/MyInfo
 * on top of itself to add the other capability or view details, rather than needing a second
 * top-level navigator. `initialRouteName` is decided from the verification status known by
 * the time this Stack.Navigator mounts.
 *
 * This used to gate only on `isLoading`, not `isError` — since TanStack Query's `isLoading`
 * becomes `false` on a settled *error* just as much as a settled success, a transient
 * network/timeout failure on either query (retries exhausted) made `hasVerifiedCapability`
 * compute `false` for a genuinely verified user, and `Stack.Navigator` locked in
 * `initialRouteName="ChooseCapability"` — a single non-tab screen with a bare logout icon
 * in its header, which is exactly the "only one tab, no tabs, just a logout icon" bug
 * report this was fixed for. Since `initialRouteName` is a mount-once prop, the user was
 * stuck there until they killed and relaunched the app. Fixed two ways: (1) an error state
 * is now shown with a manual retry instead of silently falling through to ChooseCapability,
 * and (2) `Stack.Navigator` is `key`ed on `hasVerifiedCapability` so it remounts — and
 * re-reads `initialRouteName` fresh — if that value ever changes within the same app
 * session (a failed load recovering via retry, or a capability getting verified while the
 * app happens to be open), instead of being locked to whatever it first mounted with.
 *
 * That `key` remount is also what makes the two refetch triggers added alongside it
 * actually visible: `ChooseCapabilityScreen`'s pull-to-refresh, and `App.tsx`'s
 * AppState→`focusManager` wiring (any query, including this one, auto-refetches whenever
 * the app returns to the foreground). Before those existed, verifying a capability in
 * admin-web had no way to reach this screen at all short of fully killing and relaunching
 * the app — `useMyWorkerProfile()`/`useMyBusinessProfile()` only ever fetched once, on
 * mount, with nothing to trigger a second fetch.
 */
export function MainNavigator() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const workerProfile = useMyWorkerProfile();
  const businessProfile = useMyBusinessProfile();

  if (workerProfile.isLoading || businessProfile.isLoading) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: colors.background }]}>
        <LoadingIndicator color={colors.primary} />
      </View>
    );
  }

  if (workerProfile.isError || businessProfile.isError) {
    const isRetrying = workerProfile.isRefetching || businessProfile.isRefetching;
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>{t('common.errorTitle')}</Text>
        <Text style={[styles.errorMessage, { color: colors.textMuted }]}>{t('errors.generic')}</Text>
        <Button
          label={t('common.retry')}
          loading={isRetrying}
          onPress={() => {
            if (workerProfile.isError) workerProfile.refetch();
            if (businessProfile.isError) businessProfile.refetch();
          }}
        />
      </View>
    );
  }

  const hasVerifiedCapability =
    workerProfile.data?.verificationStatus === 'verified' || businessProfile.data?.verificationStatus === 'verified';

  return (
    <Stack.Navigator
      key={hasVerifiedCapability ? 'verified' : 'unverified'}
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

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', padding: 32 },
  errorTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 8, textAlign: 'center' },
  errorMessage: { ...typography.body, textAlign: 'center', marginBottom: 20 },
});
