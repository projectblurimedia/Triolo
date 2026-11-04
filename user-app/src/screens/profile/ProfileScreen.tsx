import React, { useState } from 'react';
import { DetailRow, GradientCard } from '@/components/GradientCard';
import { useQueryClient } from '@tanstack/react-query';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { PullToRefresh } from '@/components/PullToRefresh';
import { SmartImage } from '@/components/SmartImage';
import { WorkerProfileCard } from '@/components/WorkerProfileCard';
import { BusinessProfileCard } from '@/components/BusinessProfileCard';
import { ProfileActivity, ProfileOrders } from '@/components/ProfileActivity';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { EditProfileModal } from '@/components/EditProfileModal';
import { placeName } from '@/utils/formatAddress';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { FullText } from '@/components/FullText';

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
// website, per product decision) — this screen only shows a capability that already exists on
// the account (editing it is done in the Partner app).
export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const account = useAuthStore((state) => state.account);
  const { data: workerProfile } = useMyWorkerProfile();
  const { data: businessProfile } = useMyBusinessProfile();
  const initial = account?.fullName?.trim().charAt(0).toUpperCase() ?? '?';
  const hasNoCapability = !workerProfile && !businessProfile;
  // CustomTabBar floats via `position: 'absolute'` (see its own doc comment), so it
  // contributes ~0 height to layout and never reserves scroll space on its own — every
  // scrollable tab screen has to clear it manually. Its own footprint is
  // `Math.max(insets.bottom, 18) + 66` (bottom margin + bar height); a flat 32 wasn't
  // enough once both capability sections render, so the last card sat under the bar.
  const tabBarClearance = Math.max(insets.bottom, 18) + 66 + 24;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const { isDark } = useThemeColors();
  // Everything on this tab (profiles, bookings, orders) reloads together.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarClearance }}>
          {account ? (
            <LinearGradient colors={HERO_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, HERO_SHADOW]}>
              {/* Soft light circles give the card depth. */}
              <View style={[styles.bubble, styles.bubbleLarge]} />
              <View style={[styles.bubble, styles.bubbleSmall]} />

              <View style={styles.heroTop}>
                <View style={styles.avatarRing}>
                  {account.profilePhotoUrl ? (
                    <SmartImage source={{ uri: account.profilePhotoUrl }} style={styles.avatar} />
                  ) : (
                    <LinearGradient
                      colors={['#FFFFFF', '#DCE8FF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.avatar}
                    >
                      <Text style={styles.avatarText}>{initial}</Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={styles.heroIdentity}>
                  <FullText style={styles.heroName} numberOfLines={1}>
                    {account.fullName}
                  </FullText>
                  {account.status === 'active' ? (
                    <View style={styles.statusPill}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>{t('profile.activeStatus')}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </LinearGradient>
          ) : null}

          {account ? <SubscriptionCard /> : null}

          {account ? (
            <GradientCard
              title={t('profile.detailsTitle')}
              icon="id-card"
              action={{ label: t('common.edit'), icon: 'pen', onPress: () => setEditVisible(true) }}
              style={styles.detailsCard}
            >
              {[
                { icon: 'phone' as const, label: t('profile.detailPhone'), value: account.mobileNumber },
                ...(account.email ? [{ icon: 'envelope' as const, label: t('profile.detailEmail'), value: account.email }] : []),
                ...(placeName(account.locationAddress)
                  ? [{ icon: 'location-dot' as const, label: t('profile.detailPlace'), value: placeName(account.locationAddress) }]
                  : []),
              ].map((row, index) => (
                <DetailRow key={row.icon} icon={row.icon} label={row.label} value={row.value} first={index === 0} />
              ))}
            </GradientCard>
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
              <WorkerProfileCard profile={workerProfile} />
            </View>
          ) : null}

          {businessProfile ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('profile.businessSection')}</Text>
              <BusinessProfileCard profile={businessProfile} />
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
      </PullToRefresh>
      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Compact: just who you are. Contact details are in the card below.
  hero: { borderRadius: 22, padding: 16, marginBottom: 20, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  bubbleLarge: { width: 150, height: 150, top: -70, right: -40 },
  bubbleSmall: { width: 90, height: 90, bottom: -50, left: -20 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: { width: 58, height: 58, borderRadius: 29, padding: 3, backgroundColor: 'rgba(255, 255, 255, 0.28)' },
  avatar: { flex: 1, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: fonts.semiBold, fontSize: 22, lineHeight: 28, color: '#0055D3', includeFontPadding: false, transform: [{ translateY: 1 }] },
  heroIdentity: { flex: 1, gap: 6 },
  heroName: { ...typography.subheading, fontFamily: fonts.semiBold, fontSize: 18, lineHeight: 24, color: '#FFFFFF' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  statusText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11, color: '#FFFFFF' },
  detailsCard: { marginBottom: 20 },
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
