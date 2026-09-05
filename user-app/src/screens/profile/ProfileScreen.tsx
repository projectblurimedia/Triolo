import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
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

// Real drop shadow, matching the convention already established by ToastHost — every
// card on this screen shares it instead of the earlier flat 1px-bordered look.
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 16 },
  android: { elevation: 6 },
});

// Rating/completed-work counts are placeholder content until the ratings/reviews and
// booking/order modules exist (see .cloud/project-context.md) — shown once the account has
// added the Worker and/or Business capability (see "Account Model"), not based on
// accounts.role, which is always 'user' for every self-registered account regardless of
// capabilities added. Each capability gets its own stats row + profile card, since a
// rating/completed-work count is per-capability, not per-account. Worker/Business
// registration itself now happens outside this app (Triolo Partner app / registration
// website, per product decision) — this screen only shows and lets you edit a capability
// that already exists on the account.
export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const { data: workerProfile } = useMyWorkerProfile();
  const { data: businessProfile } = useMyBusinessProfile();
  const initial = account?.fullName?.trim().charAt(0).toUpperCase() ?? '?';
  const [editWorkerVisible, setEditWorkerVisible] = useState(false);
  const [editBusinessVisible, setEditBusinessVisible] = useState(false);
  const hasNoCapability = !workerProfile && !businessProfile;

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {account ? (
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, CARD_SHADOW]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.heroName} numberOfLines={1}>
              {account.fullName}
            </Text>
            <View style={styles.heroMetaRow}>
              <FontAwesome6 name="phone" size={11} color="rgba(255, 255, 255, 0.85)" solid />
              <Text style={styles.heroMeta}>{account.mobileNumber}</Text>
            </View>
            {account.email ? (
              <View style={styles.heroMetaRow}>
                <FontAwesome6 name="envelope" size={11} color="rgba(255, 255, 255, 0.85)" solid />
                <Text style={styles.heroMeta} numberOfLines={1}>
                  {account.email}
                </Text>
              </View>
            ) : null}
            {account.status === 'active' ? (
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{t('profile.activeStatus')}</Text>
              </View>
            ) : null}
          </LinearGradient>
        ) : null}

        {workerProfile ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('profile.workerSection')}</Text>
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
          </View>
        ) : null}

        {businessProfile ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('profile.businessSection')}</Text>
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
          </View>
        ) : null}

        {hasNoCapability ? (
          <View style={[styles.emptyCard, CARD_SHADOW, { backgroundColor: colors.surface }]}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}1A` }]}>
              <FontAwesome6 name="circle-info" size={18} color={colors.primary} solid />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('profile.noCapabilitiesTitle')}</Text>
            <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('profile.noCapabilitiesMessage')}</Text>
          </View>
        ) : null}
      </ScrollView>

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
  scrollContent: { paddingBottom: 32 },
  hero: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    ...typography.heading,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
    fontSize: typography.heading.fontSize + 6,
  },
  heroName: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  heroMeta: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  statusText: { ...typography.caption, fontFamily: fonts.medium, color: '#FFFFFF' },
  section: { marginBottom: 4 },
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  emptyCard: {
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: { ...typography.body, fontFamily: fonts.semiBold, marginBottom: 6, textAlign: 'center' },
  emptyMessage: { ...typography.caption, textAlign: 'center', lineHeight: 18 },
});
