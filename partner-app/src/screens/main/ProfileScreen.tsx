import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { VerificationBadge } from '@/components/VerificationBadge';
import { WorkerReviewsSection } from '@/components/WorkerProfileGlass';
import { useMyReviews, useMyShopReviews } from '@/hooks/useReviews';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { MainStackParamList, MainTabParamList } from '@/navigation/types';
import { categoryIcon, JobPostCard, jobTitle } from '@/components/JobPostCard';
import { JobPostsSheet } from '@/components/JobPostsSheet';
import { SmartImage } from '@/components/SmartImage';
import { useMyJobPosts } from '@/hooks/useJobPost';

// As many as the server allows (jobSeekers MAX_JOB_POSTS).
const MAX_JOB_POSTS = 5;
import { SealedPhoto } from '@/components/TrustedSeal';
import { useTrustedKinds } from '@/hooks/useSubscription';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Profile'>, NativeStackScreenProps<MainStackParamList>>;

/**
 * The verified-partner app's account tab — a gradient identity banner (avatar initials,
 * name/mobile/email), a summary card per capability with a quick fact and its verification
 * status (linking into the existing read-only MyInfo screen for full details — which now
 * also carries the edit/delete entry point, reused rather than duplicated here), and a
 * prompt card to add whichever capability isn't registered yet. No inline logout on this
 * screen — matching user-app's own Profile screen, logout lives only in the header's
 * SettingsMenuModal (see MainTabNavigator), reachable from every tab, not just this one.
 */
export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);

  const workerProfile = useMyWorkerProfile();
  const businessProfile = useMyBusinessProfile();
  const worker = workerProfile.data;
  const reviews = useMyReviews(!!worker);
  const jobPosts = useMyJobPosts();
  const [postsOpen, setPostsOpen] = useState(false);
  const posts = jobPosts.data ?? [];
  const livePosts = posts.filter((post) => post.isActive).length;
  const shop = businessProfile.data;
  const shopReviews = useMyShopReviews(!!shop);
  // Profiles with an active Trusted by Triolo badge.
  const trustedKinds = useTrustedKinds();

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.body}>
        {account ? (
          <>
            {/* Compact: just who you are. Contact details are in the card below. */}
            <LinearGradient
              colors={['#0A3FAE', '#0055D3', '#2B83FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={[styles.bubble, styles.bubbleLarge]} />
              <View style={[styles.bubble, styles.bubbleSmall]} />
              <View style={styles.heroRow}>
                <View style={styles.avatarRing}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitials}>{getInitials(account.fullName)}</Text>
                  </View>
                </View>
                <View style={styles.heroIdentity}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {account.fullName}
                  </Text>
                  <View style={styles.statusPill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>{t('mainTabs.Profile.activeStatus')}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('mainTabs.Profile.detailsTitle')}</Text>
            <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[
                { icon: 'phone' as const, label: t('mainTabs.Profile.detailPhone'), value: account.mobileNumber },
                ...(account.email
                  ? [{ icon: 'envelope' as const, label: t('mainTabs.Profile.detailEmail'), value: account.email }]
                  : []),
              ].map((row, index) => (
                <View
                  key={row.icon}
                  style={[
                    styles.detailRow,
                    index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                  ]}
                >
                  <View style={[styles.detailIcon, { backgroundColor: `${colors.primary}14` }]}>
                    <FontAwesome6 name={row.icon} size={13} color={colors.primary} solid />
                  </View>
                  <View style={styles.detailText}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{row.label}</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('mainTabs.Profile.capabilitiesLabel')}</Text>

        <CapabilityRow
          icon="screwdriver-wrench"
          title={t('mainTabs.Profile.workerTitle')}
          profile={workerProfile.data}
          photoUrl={worker?.profilePhotoUrl}
          trusted={trustedKinds.has('service')}
          name={account?.fullName}
          quickFact={
            worker
              ? [
                  ...worker.skillCategories.filter((key) => key !== 'other').map((key) => t(`workerProfile.skills.${key}`)),
                  ...(worker.otherSkillDescription ? [worker.otherSkillDescription] : []),
                ].join(', ')
              : undefined
          }
          addLabel={t('mainTabs.Profile.addWorker')}
          onView={() => navigation.navigate('MyInfo', { capability: 'worker' })}
          onAdd={() => navigation.navigate('WorkerRegistration')}
          colors={colors}
        />
        <CapabilityRow
          icon="store"
          title={t('mainTabs.Profile.businessTitle')}
          profile={businessProfile.data}
          photoUrl={shop?.profilePhotoUrl}
          trusted={trustedKinds.has('business')}
          name={shop?.shopName}
          quickFact={shop && account ? t('mainTabs.Profile.ownerLine', { name: account.fullName }) : undefined}
          addLabel={t('mainTabs.Profile.addBusiness')}
          onView={() => navigation.navigate('MyInfo', { capability: 'business' })}
          onAdd={() => navigation.navigate('BusinessRegistration')}
          colors={colors}
        />

        {posts.length === 1 ? (
          <JobPostCard
            post={posts[0]}
            name={account?.fullName}
            compact
            onPress={() => navigation.navigate('MyInfo', { capability: 'job', postId: posts[0].id })}
          />
        ) : null}
        {posts.length > 1 ? (
          <Pressable
            onPress={() => setPostsOpen(true)}
            style={({ pressed }) => [styles.postsCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={styles.postsIcons}>
              {posts.slice(0, 3).map((post, index) => (
                <LinearGradient
                  key={post.id}
                  colors={headerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.postsIcon, { borderColor: colors.surface, marginLeft: index === 0 ? 0 : -12 }]}
                >
                  <FontAwesome6 name={categoryIcon(post.category) as never} size={13} color="#FFFFFF" solid />
                </LinearGradient>
              ))}
            </View>
            <View style={styles.flex}>
              <Text style={[styles.addPostTitle, { color: colors.text }]} numberOfLines={1}>
                {t('jobPost.postsTitle')}
              </Text>
              <Text style={[styles.addPostText, { color: colors.textMuted }]} numberOfLines={1}>
                {posts.map((post) => jobTitle(post, t)).join(' · ')}
              </Text>
              <Text style={[styles.postsCount, { color: colors.primary }]}>
                {t('jobPost.postsCount', { count: posts.length, live: livePosts })}
              </Text>
            </View>
            <FontAwesome6 name="chevron-right" size={13} color={colors.textMuted} solid />
          </Pressable>
        ) : null}
        <JobPostsSheet
          visible={postsOpen}
          posts={posts}
          name={account?.fullName}
          canAdd={posts.length < MAX_JOB_POSTS}
          onClose={() => setPostsOpen(false)}
          onOpen={(post) => {
            setPostsOpen(false);
            navigation.navigate('MyInfo', { capability: 'job', postId: post.id });
          }}
          onAdd={() => {
            setPostsOpen(false);
            navigation.navigate('JobPost', {});
          }}
        />
        {/* The first post, or a second one; from two on, Add another lives in the sheet. */}
        {posts.length < 2 ? (
          <Pressable
            onPress={() => navigation.navigate('JobPost', {})}
            style={({ pressed }) => [styles.addPost, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}0A`, opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={[styles.addPostIcon, { backgroundColor: colors.primary }]}>
              <FontAwesome6 name="plus" size={13} color="#FFFFFF" solid />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.addPostTitle, { color: colors.text }]}>
                {t(posts.length > 0 ? 'jobPost.addAnother' : 'jobPost.lookingTitle')}
              </Text>
              <Text style={[styles.addPostText, { color: colors.textMuted }]} numberOfLines={1}>
                {t('jobPost.addAnotherHint')}
              </Text>
            </View>
            <FontAwesome6 name="chevron-right" size={13} color={colors.textMuted} solid />
          </Pressable>
        ) : null}


        {worker ? <WorkerReviewsSection summary={reviews.data} loading={reviews.isLoading} error={reviews.isError} /> : null}
        {shop ? (
          <WorkerReviewsSection
            summary={shopReviews.data}
            loading={shopReviews.isLoading}
            error={shopReviews.isError}
            title={t('shopOrders.shopReviewsTitle', { shop: shop.shopName })}
          />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface CapabilityRowProps {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  title: string;
  profile: { verificationStatus: string } | null | undefined;
  /** This profile's own photo (worker face / shop logo); the icon shows when there is none. */
  photoUrl?: string | null;
  /** The profile has an active Trusted by Triolo badge (its photo shows the seal). */
  trusted?: boolean;
  /** Who or what this profile is: the worker's name, or the shop's name. */
  name?: string;
  quickFact?: string;
  addLabel: string;
  onView: () => void;
  onAdd: () => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
}

function CapabilityRow({ icon, title, profile, photoUrl, name, quickFact, addLabel, onView, onAdd, colors, trusted }: CapabilityRowProps) {
  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={profile ? onView : onAdd}>
      {profile && photoUrl ? (
        <View style={styles.cardPhotoWrap}>
          <SealedPhoto size={42} trusted={!!trusted}>
            <SmartImage source={{ uri: photoUrl }} style={styles.cardPhoto} />
          </SealedPhoto>
        </View>
      ) : (
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardIcon}>
          <FontAwesome6 name={icon} size={18} color="#FFFFFF" solid />
        </LinearGradient>
      )}
      <View style={styles.cardText}>
        {profile ? (
          <>
            <Text style={[styles.cardCaption, { color: colors.primary }]}>{title}</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {name ?? title}
            </Text>
            {quickFact ? (
              <Text style={[styles.cardQuickFact, { color: colors.textMuted }]} numberOfLines={1}>
                {quickFact}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{addLabel}</Text>
          </>
        )}
      </View>
      {/* Verified is the normal state, so it isn't shown; only "pending" / "rejected" are. */}
      {profile && profile.verificationStatus !== 'verified' ? (
        <View style={styles.statusWrap}>
          <VerificationBadge status={profile.verificationStatus} />
        </View>
      ) : null}
      <FontAwesome6 name="chevron-right" size={13} color={colors.textMuted} solid />
    </Pressable>
  );
}

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 3,
};

const styles = StyleSheet.create({
  // No paddingTop here — ScreenContainer's own `flex` style already contributes 20px on
  // every side; adding another top-only paddingVertical stacked the two, making the gap
  // above heroCard roughly double the gap on its left/right (ScreenContainer's own 20px
  // isn't horizontal-only — it's uniform on all sides, so the imbalance was purely this
  // extra vertical-only padding layered on top of it).
  // Clears the floating CustomTabBar so the last review isn't hidden under it.
  body: { paddingBottom: 140 },
  heroCard: { borderRadius: 22, padding: 16, marginBottom: 24, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  bubbleLarge: { width: 150, height: 150, top: -70, right: -40 },
  bubbleSmall: { width: 90, height: 90, bottom: -50, left: -20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: { width: 58, height: 58, borderRadius: 29, padding: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  avatar: { flex: 1, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: fonts.semiBold, fontSize: 22, lineHeight: 28, color: '#0055D3' },
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  statusText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11, color: '#FFFFFF' },
  detailsCard: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, marginBottom: 24 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  detailIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  detailText: { flex: 1 },
  detailLabel: { ...typography.caption, fontSize: 11 },
  detailValue: { ...typography.body, fontFamily: fonts.medium, fontSize: 14, marginTop: 1 },
  sectionLabel: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    marginTop: 4,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    ...CARD_SHADOW,
  },
  cardIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardPhotoWrap: { marginRight: 12 },
  cardPhoto: { width: 42, height: 42, borderRadius: 21 },
  cardCaption: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, letterSpacing: 0.3 },
  cardText: { flex: 1, marginRight: 8 },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  cardQuickFact: { ...typography.caption, fontSize: 11.5, marginTop: 1 },
  statusWrap: { marginRight: 8 },
  flex: { flex: 1 },
  postsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10 },
  postsIcons: { flexDirection: 'row' },
  postsIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  postsCount: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, marginTop: 1 },
  addPost: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 },
  addPostIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addPostTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14.5 },
  addPostText: { ...typography.caption, fontSize: 11.5 },
  cardSubtitle: { ...typography.caption, marginTop: 3 },
});
