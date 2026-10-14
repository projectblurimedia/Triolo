import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { WorkerProfileCard } from '@/components/WorkerProfileCard';
import { BusinessProfileCard } from '@/components/BusinessProfileCard';
import { WorkerProfileModal } from '@/components/WorkerProfileModal';
import { BusinessProfileModal } from '@/components/BusinessProfileModal';
import { ProfileStatsRow } from '@/components/ProfileStatsRow';
import { ProfileActivity, ProfileOrders } from '@/components/ProfileActivity';
import { SHOP_GRADIENT } from '@/components/BusinessProfileModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';

// A deeper three-stop blue for the profile card, so it reads richer than the flat header.
const HERO_GRADIENT = ['#0A3FAE', '#0055D3', '#2B83FF'] as const;
// Brand-tinted glow under the profile card.
const HERO_SHADOW = Platform.select({
  ios: { shadowColor: '#0055D3', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 18 },
  android: { elevation: 5 },
});
// A light lift for plain cards — just enough to separate them from the background.
const SOFT_SHADOW = Platform.select({
  ios: { shadowColor: '#0B2A5B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8 },
  android: { elevation: 1.5 },
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
  const insets = useSafeAreaInsets();
  const account = useAuthStore((state) => state.account);
  const { data: workerProfile } = useMyWorkerProfile();
  const { data: businessProfile } = useMyBusinessProfile();
  const initial = account?.fullName?.trim().charAt(0).toUpperCase() ?? '?';
  const [editWorkerVisible, setEditWorkerVisible] = useState(false);
  const [editBusinessVisible, setEditBusinessVisible] = useState(false);
  const hasNoCapability = !workerProfile && !businessProfile;
  // CustomTabBar floats via `position: 'absolute'` (see its own doc comment), so it
  // contributes ~0 height to layout and never reserves scroll space on its own — every
  // scrollable tab screen has to clear it manually. Its own footprint is
  // `Math.max(insets.bottom, 18) + 66` (bottom margin + bar height); a flat 32 wasn't
  // enough once both capability sections render, so the last card sat under the bar.
  const tabBarClearance = Math.max(insets.bottom, 18) + 66 + 24;

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarClearance }}>
        {account ? (
          <LinearGradient
            colors={HERO_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, HERO_SHADOW]}
          >
            {/* Soft light circles give the card depth. */}
            <View style={[styles.bubble, styles.bubbleLarge]} />
            <View style={[styles.bubble, styles.bubbleSmall]} />

            <View style={styles.heroTop}>
              <View style={styles.avatarRing}>
                <LinearGradient
                  colors={['#FFFFFF', '#DCE8FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>{initial}</Text>
                </LinearGradient>
              </View>
              <View style={styles.heroIdentity}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {account.fullName}
                </Text>
                {account.status === 'active' ? (
                  <View style={styles.statusPill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>{t('profile.activeStatus')}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroChips}>
              <View style={styles.heroChip}>
                <View style={styles.heroChipIcon}>
                  <FontAwesome6 name="phone" size={11} color={headerGradient[0]} solid />
                </View>
                <Text style={styles.heroChipText} numberOfLines={1}>
                  {account.mobileNumber}
                </Text>
              </View>
              {account.email ? (
                <View style={[styles.heroChip, styles.heroChipWide]}>
                  <View style={styles.heroChipIcon}>
                    <FontAwesome6 name="envelope" size={11} color={headerGradient[0]} solid />
                  </View>
                  <Text style={styles.heroChipText} numberOfLines={1}>
                    {account.email}
                  </Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        ) : null}

        {account ? (
          <>
            <ProfileActivity />
            <ProfileOrders />
          </>
        ) : null}

        {workerProfile ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('profile.workerSection')}</Text>
            <ProfileStatsRow
              stats={[
                {
                  icon: 'star',
                  value: workerProfile.ratingAverage != null ? workerProfile.ratingAverage.toFixed(1) : t('workerReviews.new'),
                  label: t('workerReviews.statRating'),
                  tint: colors.primary,
                },
                {
                  icon: 'circle-check',
                  value: String(workerProfile.ratingCount),
                  label: t('workerReviews.statRatedJobs'),
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
                {
                  icon: 'star',
                  value:
                    businessProfile.ratingAverage != null ? businessProfile.ratingAverage.toFixed(1) : t('workerReviews.new'),
                  label: t('workerReviews.statRating'),
                  tint: SHOP_GRADIENT[0],
                },
                {
                  icon: 'bag-shopping',
                  value: String(businessProfile.ratingCount),
                  label: t('profile.ratedOrders'),
                  tint: SHOP_GRADIENT[0],
                },
              ]}
            />
            <BusinessProfileCard profile={businessProfile} onEdit={() => setEditBusinessVisible(true)} />
          </View>
        ) : null}

        {hasNoCapability ? (
          <View style={[styles.emptyCard, SOFT_SHADOW, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
  hero: { borderRadius: 24, padding: 18, marginBottom: 20, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  bubbleLarge: { width: 180, height: 180, top: -70, right: -50 },
  bubbleSmall: { width: 110, height: 110, bottom: -50, left: -30 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  avatar: { flex: 1, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: fonts.semiBold, fontSize: 26, lineHeight: 32, color: '#0055D3' },
  heroIdentity: { flex: 1, gap: 6 },
  heroName: { ...typography.subheading, fontFamily: fonts.semiBold, fontSize: 19, lineHeight: 25, color: '#FFFFFF' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  statusText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11, color: '#FFFFFF' },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255, 255, 255, 0.3)', marginVertical: 14 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    maxWidth: '100%',
  },
  heroChipWide: { flexShrink: 1 },
  heroChipIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  heroChipText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12, color: '#FFFFFF', flexShrink: 1 },
  section: { marginBottom: 4 },
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
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
