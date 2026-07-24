import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '@/components/ScreenContainer';
import { WorkerProfileCard } from '@/components/WorkerProfileCard';
import { BusinessProfileCard } from '@/components/BusinessProfileCard';
import { WorkerProfileModal } from '@/components/WorkerProfileModal';
import { BusinessProfileModal } from '@/components/BusinessProfileModal';
import { ProfileStatsRow } from '@/components/ProfileStatsRow';
import { SHOP_GRADIENT } from '@/components/BusinessProfileModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';

// Rating/completed-work counts are placeholder content until the ratings/reviews and
// booking/order modules exist (see .cloud/project-context.md) — shown once the account has
// added the Worker and/or Business capability (see "Account Model"), not based on
// accounts.role, which is always 'user' for every self-registered account regardless of
// capabilities added. Each capability gets its own stats row + profile card, since a
// rating/completed-work count is per-capability, not per-account.
export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const { data: workerProfile } = useMyWorkerProfile();
  const { data: businessProfile } = useMyBusinessProfile();
  const initial = account?.fullName?.trim().charAt(0).toUpperCase() ?? '?';
  const [editWorkerVisible, setEditWorkerVisible] = useState(false);
  const [editBusinessVisible, setEditBusinessVisible] = useState(false);

  return (
    <ScreenContainer edges={['left', 'right']}>
      {account ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
          <View style={styles.cardInfo}>
            <Text style={[styles.name, { color: colors.text }]}>{account.fullName}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{account.mobileNumber}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {account.role} · {account.status}
            </Text>
          </View>
        </View>
      ) : null}

      {workerProfile ? (
        <>
          <ProfileStatsRow
            stats={[
              { icon: 'star', value: t('profile.ratingValue'), label: t('profile.ratingCount'), tint: colors.primary },
              {
                icon: 'briefcase',
                value: t('profile.servicesDoneValue'),
                label: t('profile.servicesDoneLabel'),
                tint: colors.primary,
              },
            ]}
          />
          <WorkerProfileCard profile={workerProfile} onEdit={() => setEditWorkerVisible(true)} />
        </>
      ) : null}

      {businessProfile ? (
        <>
          <ProfileStatsRow
            stats={[
              { icon: 'star', value: t('profile.ratingValue'), label: t('profile.ratingCount'), tint: SHOP_GRADIENT[0] },
              {
                icon: 'bag-shopping',
                value: t('profile.ordersDoneValue'),
                label: t('profile.ordersDoneLabel'),
                tint: SHOP_GRADIENT[0],
              },
            ]}
          />
          <BusinessProfileCard profile={businessProfile} onEdit={() => setEditBusinessVisible(true)} />
        </>
      ) : null}

      <WorkerProfileModal visible={editWorkerVisible} onClose={() => setEditWorkerVisible(false)} profile={workerProfile} />
      <BusinessProfileModal
        visible={editBusinessVisible}
        onClose={() => setEditBusinessVisible(false)}
        profile={businessProfile}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.heading,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
    fontSize: typography.heading.fontSize + 4,
  },
  cardInfo: { marginLeft: 14, flex: 1 },
  name: { ...typography.subheading, fontFamily: fonts.semiBold },
  meta: { ...typography.body, marginTop: 2 },
});
