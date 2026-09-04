import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GradientHeader } from '@/components/GradientHeader';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { ConfirmModal } from '@/components/ConfirmModal';
import { VerificationBadge } from '@/components/VerificationBadge';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useLogout } from '@/hooks/useAuthMutations';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { MainStackParamList } from '@/navigation/types';

const LOGOUT_GRADIENT = ['#ef4444', '#dc2626'] as const;

type Props = NativeStackScreenProps<MainStackParamList, 'ChooseCapability'>;

/**
 * The whole point of this app: register (or view) a Worker/Business capability on the
 * current account — same account model as user-app (see .cloud/project-context.md's
 * "Account Model"), just capability-first instead of an optional Home-menu afterthought.
 * A card per capability: not-yet-registered → tapping opens that registration screen;
 * already-registered → tapping opens the read-only MyInfo view for it instead.
 */
export function ChooseCapabilityScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const logout = useLogout();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const workerProfile = useMyWorkerProfile();
  const businessProfile = useMyBusinessProfile();
  const isLoading = workerProfile.isLoading || businessProfile.isLoading;

  const cards = [
    {
      key: 'worker' as const,
      icon: 'screwdriver-wrench' as const,
      gradient: headerGradient,
      registeredTitle: t('chooseCapability.workerRegisteredTitle'),
      unregisteredTitle: t('chooseCapability.workerUnregisteredTitle'),
      unregisteredSubtitle: t('chooseCapability.workerUnregisteredSubtitle'),
      profile: workerProfile.data,
      onPress: () =>
        workerProfile.data
          ? navigation.navigate('MyInfo', { capability: 'worker' })
          : navigation.navigate('WorkerRegistration'),
    },
    {
      key: 'business' as const,
      icon: 'store' as const,
      gradient: headerGradient,
      registeredTitle: t('chooseCapability.businessRegisteredTitle'),
      unregisteredTitle: t('chooseCapability.businessUnregisteredTitle'),
      unregisteredSubtitle: t('chooseCapability.businessUnregisteredSubtitle'),
      profile: businessProfile.data,
      onPress: () =>
        businessProfile.data
          ? navigation.navigate('MyInfo', { capability: 'business' })
          : navigation.navigate('BusinessRegistration'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title={t('common.appName')}
        subtitle={t('chooseCapability.tagline')}
        leadingIcon="shapes"
        actions={[{ icon: 'right-from-bracket', accessibilityLabel: t('common.logout'), onPress: () => setShowLogoutConfirm(true) }]}
      />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <LoadingIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {account ? (
            <Text style={[styles.greeting, { color: colors.text }]}>{t('chooseCapability.greeting', { name: account.fullName })}</Text>
          ) : null}

          {cards.map((card) => (
            <CapabilityCard key={card.key} card={card} colors={colors} />
          ))}
        </ScrollView>
      )}

      <ConfirmModal
        visible={showLogoutConfirm}
        icon="right-from-bracket"
        gradient={LOGOUT_GRADIENT}
        title={t('chooseCapability.logoutConfirmTitle')}
        message={t('chooseCapability.logoutConfirmMessage')}
        confirmLabel={t('common.logout')}
        loading={logout.isPending}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout.mutate();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}

interface CardProps {
  card: {
    key: 'worker' | 'business';
    icon: React.ComponentProps<typeof FontAwesome6>['name'];
    gradient: readonly [string, string];
    registeredTitle: string;
    unregisteredTitle: string;
    unregisteredSubtitle: string;
    profile: { verificationStatus: string } | null | undefined;
    onPress: () => void;
  };
  colors: ReturnType<typeof useThemeColors>['colors'];
}

function CapabilityCard({ card, colors }: CardProps) {
  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={card.onPress}>
      <LinearGradient colors={card.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardIcon}>
        <FontAwesome6 name={card.icon} size={20} color="#FFFFFF" solid />
      </LinearGradient>
      <View style={styles.cardText}>
        {card.profile ? (
          <>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{card.registeredTitle}</Text>
            <VerificationBadge status={card.profile.verificationStatus} />
          </>
        ) : (
          <>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{card.unregisteredTitle}</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
              {card.unregisteredSubtitle}
            </Text>
          </>
        )}
      </View>
      <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, paddingBottom: 40 },
  greeting: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 19, marginBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardText: { flex: 1, marginRight: 10 },
  cardTitle: { ...typography.subheading, fontFamily: fonts.semiBold },
  cardSubtitle: { ...typography.caption, marginTop: 3 },
});
