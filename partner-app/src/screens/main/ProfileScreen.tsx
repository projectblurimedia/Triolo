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
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyShops } from '@/hooks/useBusinessMutations';
import { MAX_SHOPS } from '@/services/businessesService';
import { ShopAvatar, ShopsSheet } from '@/components/ShopsSheet';
import { StackedAvatars } from '@/components/StackedAvatars';
import { MainStackParamList, MainTabParamList } from '@/navigation/types';
import { categoryIcon, jobTitle } from '@/components/JobPostCard';
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
  const myShops = useMyShops();
  const shops = myShops.data ?? [];
  const [shopsOpen, setShopsOpen] = useState(false);
  const worker = workerProfile.data;
  const jobPosts = useMyJobPosts();
  const [postsOpen, setPostsOpen] = useState(false);
  const posts = jobPosts.data ?? [];
  const livePosts = posts.filter((post) => post.isActive).length;
  const shop = shops[0] ?? null;
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

        {/* Services, Shop and Job Post: the same card each, so they read alike. Several shops
            or posts are one card (their pictures overlapping) that opens a list. */}
        <KindCard
          kind={t('mainTabs.Profile.workerTitle')}
          avatar={
            worker?.profilePhotoUrl ? (
              <SealedPhoto size={46} trusted={trustedKinds.has('service')}>
                <SmartImage source={{ uri: worker.profilePhotoUrl }} style={styles.kindPhoto} />
              </SealedPhoto>
            ) : (
              <IconAvatar icon={worker ? 'screwdriver-wrench' : 'plus'} />
            )
          }
          title={worker ? (account?.fullName ?? '') : t('mainTabs.Profile.addWorker')}
          fact={
            worker
              ? [
                  ...worker.skillCategories.filter((key) => key !== 'other').map((key) => t(`workerProfile.skills.${key}`)),
                  ...(worker.otherSkillDescription ? [worker.otherSkillDescription] : []),
                ].join(', ')
              : t('mainTabs.Profile.addWorkerHint')
          }
          status={worker?.verificationStatus}
          adding={!worker}
          onPress={() => (worker ? navigation.navigate('MyInfo', { capability: 'worker' }) : navigation.navigate('WorkerRegistration'))}
        />

        <KindCard
          kind={t('mainTabs.Profile.businessTitle')}
          avatar={
            shops.length > 1 ? (
              <StackedAvatars items={shops} size={24} renderItem={(entry, size) => <ShopAvatar shop={entry} size={size} />} />
            ) : shop ? (
              <ShopAvatar shop={shop} size={46} />
            ) : (
              <IconAvatar icon="plus" />
            )
          }
          title={shops.length > 1 ? t('shops.title') : shop ? shop.shopName : t('mainTabs.Profile.addBusiness')}
          fact={
            shops.length > 1
              ? `${t('shops.count', { count: shops.length })} · ${shops.map((entry) => entry.shopName).join(', ')}`
              : shop
                ? t(shop.deliveryAvailable ? 'mainTabs.Profile.shopDelivers' : 'mainTabs.Profile.shopPickup')
                : t('mainTabs.Profile.addBusinessHint')
          }
          status={shops.length === 1 ? shop?.verificationStatus : undefined}
          adding={!shop}
          onPress={() =>
            shops.length > 1
              ? setShopsOpen(true)
              : shop
                ? navigation.navigate('MyInfo', { capability: 'business', shopId: shop.id })
                : navigation.navigate('BusinessRegistration')
          }
        />

        <KindCard
          kind={t('mainTabs.Profile.jobPostTitle')}
          avatar={
            posts.length > 1 ? (
              <StackedAvatars items={posts} size={24} renderItem={(post, size) => <IconAvatar icon={categoryIcon(post.category)} size={size} />} />
            ) : (
              <IconAvatar icon={posts[0] ? categoryIcon(posts[0].category) : 'plus'} />
            )
          }
          title={posts.length > 1 ? t('jobPost.postsTitle') : posts[0] ? jobTitle(posts[0], t) : t('jobPost.lookingTitle')}
          fact={
            posts.length > 1
              ? t('jobPost.postsCount', { count: posts.length, live: livePosts })
              : posts[0]
                ? t(posts[0].isActive ? 'settingsMenu.jobPostLive' : 'settingsMenu.jobPostHidden')
                : t('mainTabs.Profile.addJobPostHint')
          }
          adding={posts.length === 0}
          onPress={() =>
            posts.length > 1
              ? setPostsOpen(true)
              : posts[0]
                ? navigation.navigate('MyInfo', { capability: 'job', postId: posts[0].id })
                : navigation.navigate('JobPost', {})
          }
        />

        {/* One shop / post: a second is added here. From two on, Add another is in the list. */}
        {shops.length === 1 && shops.length < MAX_SHOPS ? (
          <AddRow label={t('shops.addAnother')} onPress={() => navigation.navigate('BusinessRegistration')} />
        ) : null}
        {posts.length === 1 ? <AddRow label={t('jobPost.addAnother')} onPress={() => navigation.navigate('JobPost', {})} /> : null}

        <ShopsSheet
          visible={shopsOpen}
          shops={shops}
          canAdd={shops.length < MAX_SHOPS}
          onClose={() => setShopsOpen(false)}
          onOpen={(entry) => {
            setShopsOpen(false);
            navigation.navigate('MyInfo', { capability: 'business', shopId: entry.id });
          }}
          onAdd={() => {
            setShopsOpen(false);
            navigation.navigate('BusinessRegistration');
          }}
        />
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

/** A round blue avatar with an icon (a profile with no photo, or "add"). */
function IconAvatar({ icon, size = 46 }: { icon: string; size?: number }) {
  return (
    <LinearGradient
      colors={headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <FontAwesome6 name={icon as never} size={size * 0.38} color="#FFFFFF" solid />
    </LinearGradient>
  );
}

/** One profile kind on the Profile tab — the same height and layout for all three. */
function KindCard({
  kind,
  avatar,
  title,
  fact,
  status,
  adding,
  onPress,
}: {
  kind: string;
  avatar: React.ReactNode;
  title: string;
  fact: string;
  /** Shown only when not verified (pending / rejected). */
  status?: string;
  /** Not made yet: the card invites adding one. */
  adding?: boolean;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.kindCard,
        {
          backgroundColor: adding ? `${colors.primary}0A` : colors.surface,
          borderColor: adding ? `${colors.primary}40` : `${colors.primary}1F`,
          borderStyle: adding ? 'dashed' : 'solid',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.kindAvatar}>{avatar}</View>
      <View style={styles.flex}>
        <Text style={[styles.kindLabel, { color: colors.primary }]} numberOfLines={1}>
          {kind}
        </Text>
        <Text style={[styles.kindTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.kindFact, { color: colors.textMuted }]} numberOfLines={1}>
          {fact}
        </Text>
      </View>
      {status && status !== 'verified' ? <VerificationBadge status={status} /> : null}
      <FontAwesome6 name={adding ? 'plus' : 'chevron-right'} size={13} color={adding ? colors.primary : colors.textMuted} solid />
    </Pressable>
  );
}

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useThemeColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.addRow, { opacity: pressed ? 0.7 : 1 }]}>
      <FontAwesome6 name="plus" size={11} color={colors.primary} solid />
      <Text style={[styles.addRowText, { color: colors.primary }]}>{label}</Text>
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
  postsCount: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, marginTop: 1 },
  addPost: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 },
  addPostIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addPostTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14.5 },
  addPostText: { ...typography.caption, fontSize: 11.5 },
  cardSubtitle: { ...typography.caption, marginTop: 3 },
  // The three profile cards: one fixed height, one layout.
  kindCard: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 82, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 12, marginBottom: 10, ...CARD_SHADOW },
  kindAvatar: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  kindPhoto: { width: 46, height: 46, borderRadius: 23 },
  kindLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, letterSpacing: 0.4, textTransform: 'uppercase' },
  kindTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 20 },
  kindFact: { ...typography.caption, fontSize: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 4, marginBottom: 8 },
  addRowText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
});
