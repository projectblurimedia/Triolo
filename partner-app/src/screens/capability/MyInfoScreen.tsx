import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { VerificationBadge } from '@/components/VerificationBadge';
import { ProfileCover, ProfilePill, ProfileSection, PROFILE_AVATAR_SIZE } from '@/components/ProfileCover';
import { WorkerReviewsSection } from '@/components/WorkerProfileGlass';
import { PhotoViewer } from '@/components/PhotoViewer';
import { SmartImage } from '@/components/SmartImage';
import { SealedPhoto } from '@/components/TrustedSeal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { useMyReviews, useMyShopReviews } from '@/hooks/useReviews';
import { useTrustedKinds, useTrustedProfileIds } from '@/hooks/useSubscription';
import { MainStackParamList } from '@/navigation/types';
import { formatAddress } from '@/utils/formatAddress';
import { SHOP_CATEGORIES, SKILL_CATEGORIES } from '@/constants/categories';
import { useMyJobPosts } from '@/hooks/useJobPost';
import { categoryIcon, jobTitle } from '@/components/JobPostCard';
import { formatRupees } from '@/services/shopOrdersService';
import { placeName } from '@/utils/formatAddress';
import { JobPostViewsCard } from '@/components/JobPostViewsCard';
import { JobPostViewersSheet } from '@/components/JobPostViewersSheet';

type Props = NativeStackScreenProps<MainStackParamList, 'MyInfo'>;
type MyInfoNavigation = Props['navigation'];
type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

const DELIVERY_GRADIENT = ['#15803D', '#22C55E'] as const;

/**
 * The partner's own Worker / Shop profile, laid out like the customer app's profile pages
 * (ProfileCover — a copy, keep in sync): a short blue cover with back and Edit, the photo,
 * the name, the approval status and place, a stats card, what they do / sell as round
 * highlights, the photos and the customers' reviews. Edit opens the registration screen in
 * edit mode.
 */
export function MyInfoScreen({ route, navigation }: Props) {
  const { capability, postId } = route.params;
  if (capability === 'job') return <JobInfo navigation={navigation} postId={postId} />;
  return capability === 'worker' ? <WorkerInfo navigation={navigation} /> : <BusinessInfo navigation={navigation} />;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** The round photo on the cover: the picture, or initials / a shop icon on blue. */
function Avatar({ photoUrl, label, shop, trusted, onOpen }: { photoUrl?: string | null; label: string; shop?: boolean; trusted: boolean; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} disabled={!photoUrl} accessibilityRole="imagebutton" accessibilityLabel={label}>
      <SealedPhoto size={PROFILE_AVATAR_SIZE} trusted={trusted}>
        {photoUrl ? (
          <SmartImage source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            {shop ? <FontAwesome6 name="store" size={30} color="#FFFFFF" solid /> : <Text style={styles.initials}>{initialsOf(label)}</Text>}
          </LinearGradient>
        )}
      </SealedPhoto>
    </Pressable>
  );
}

/** Edit, as a frosted round button on the blue cover. */
function EditButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={styles.coverButton}>
      <FontAwesome6 name="pen" size={14} color="#FFFFFF" solid />
    </Pressable>
  );
}

function Gallery({ urls, onOpen }: { urls: string[]; onOpen: (index: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
      {urls.map((url, index) => (
        <Pressable key={url} onPress={() => onOpen(index)}>
          <SmartImage source={{ uri: url }} style={styles.galleryImage} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function LoadingView() {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
      <LoadingIndicator color={colors.primary} />
    </View>
  );
}

function WorkerInfo({ navigation }: { navigation: MyInfoNavigation }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const account = useAuthStore((state) => state.account);
  const { data: profile, isLoading } = useMyWorkerProfile();
  const reviews = useMyReviews(!!profile);
  const trustedKinds = useTrustedKinds();
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null);

  if (isLoading || !profile) return <LoadingView />;
  const name = account?.fullName ?? t('workerProfile.title');
  const work: { label: string; icon: IconName }[] = [
    ...profile.skillCategories
      .filter((key) => key !== 'other')
      .map((key) => ({
        label: t(`workerProfile.skills.${key}`),
        icon: (SKILL_CATEGORIES.find((entry) => entry.key === key)?.icon ?? 'screwdriver-wrench') as IconName,
      })),
    ...(profile.otherSkillDescription ?? '').split(', ').filter(Boolean).map((label) => ({ label, icon: 'screwdriver-wrench' as IconName })),
  ];
  const rating = reviews.data?.ratingAverage ?? null;
  const place = formatAddress(profile);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ProfileCover
        topInset={insets.top}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        right={<EditButton label={t('common.edit')} onPress={() => navigation.navigate('WorkerRegistration', { profile })} />}
        avatar={
          <Avatar
            photoUrl={profile.profilePhotoUrl}
            label={name}
            trusted={trustedKinds.has('service')}
            onOpen={() => profile.profilePhotoUrl && setViewer({ photos: [profile.profilePhotoUrl], index: 0 })}
          />
        }
        name={name}
        kicker={{ icon: 'screwdriver-wrench', label: t('myInfo.kickerWorker') }}
        pills={
          <>
            <VerificationBadge status={profile.verificationStatus} />
            {place ? <ProfilePill icon="location-dot" label={place} /> : null}
          </>
        }
        stats={[
          { icon: 'star', value: rating != null ? rating.toFixed(1) : t('workerReviews.new'), label: t('workerReviews.statRating'), gold: true },
          { icon: 'circle-check', value: String(reviews.data?.ratingCount ?? 0), label: t('workerReviews.statRatedJobs') },
          {
            icon: 'briefcase',
            value: t('workerReviews.experienceValue', { count: profile.experienceYears }),
            label: t('workerReviews.statExperience'),
          },
        ]}
        highlights={{ title: t('myInfo.workIDo'), items: work }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {profile.portfolioPhotoUrls.length > 0 ? (
          <ProfileSection icon="images" title={t('myInfo.workPhotos')} count={profile.portfolioPhotoUrls.length}>
            <Gallery urls={profile.portfolioPhotoUrls} onOpen={(index) => setViewer({ photos: profile.portfolioPhotoUrls, index })} />
          </ProfileSection>
        ) : null}
        <WorkerReviewsSection summary={reviews.data} loading={reviews.isLoading} error={reviews.isError} />
      </ProfileCover>
      <PhotoViewer photos={viewer?.photos ?? []} startIndex={viewer ? viewer.index : null} onClose={() => setViewer(null)} />
    </View>
  );
}

function BusinessInfo({ navigation }: { navigation: MyInfoNavigation }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { data: profile, isLoading } = useMyBusinessProfile();
  const reviews = useMyShopReviews(!!profile);
  const trustedKinds = useTrustedKinds();
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null);

  if (isLoading || !profile) return <LoadingView />;
  const kinds: { label: string; icon: IconName }[] = [
    ...profile.shopCategories
      .filter((key) => key !== 'other')
      .map((key) => ({
        label: t(`businessProfile.categories.${key}`),
        icon: (SHOP_CATEGORIES.find((entry) => entry.key === key)?.icon ?? 'store') as IconName,
      })),
    ...(profile.otherCategoryDescription ?? '').split(', ').filter(Boolean).map((label) => ({ label, icon: 'tag' as IconName })),
  ];
  const rating = reviews.data?.ratingAverage ?? null;
  const place = formatAddress(profile);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ProfileCover
        topInset={insets.top}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        right={<EditButton label={t('common.edit')} onPress={() => navigation.navigate('BusinessRegistration', { profile })} />}
        avatar={
          <Avatar
            photoUrl={profile.profilePhotoUrl}
            label={profile.shopName}
            shop
            trusted={trustedKinds.has('business')}
            onOpen={() => profile.profilePhotoUrl && setViewer({ photos: [profile.profilePhotoUrl], index: 0 })}
          />
        }
        name={profile.shopName}
        kicker={{ icon: 'store', label: t('myInfo.kickerShop') }}
        pills={
          <>
            <VerificationBadge status={profile.verificationStatus} />
            {place ? <ProfilePill icon="location-dot" label={place} /> : null}
          </>
        }
        stats={[
          { icon: 'star', value: rating != null ? rating.toFixed(1) : t('workerReviews.new'), label: t('workerReviews.statRating'), gold: true },
          { icon: 'users', value: String(reviews.data?.ratingCount ?? 0), label: t('myInfo.ratings') },
          { icon: 'truck', value: t(profile.deliveryAvailable ? 'myInfo.deliversYes' : 'myInfo.deliversNo'), label: t('myInfo.delivery') },
        ]}
        beforeHighlights={
          profile.deliveryAvailable ? (
            // One slim row: the truck, Home delivery, and the charges on the right.
            <LinearGradient colors={DELIVERY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.deliveryBanner}>
              <View style={styles.deliveryGlow} />
              <View style={styles.deliveryIcon}>
                <FontAwesome6 name="truck-fast" size={14} color="#FFFFFF" solid />
              </View>
              <Text style={[styles.deliveryTitle, styles.flex]} numberOfLines={1}>
                {t('myInfo.deliveryTitle')}
              </Text>
              <View style={styles.deliveryCharges}>
                <Text style={styles.deliveryChargeText} numberOfLines={1}>
                  {t('myInfo.deliveryChargeLine', {
                    perKm: profile.deliveryPricePerKm ?? 0,
                    min: profile.deliveryMinCharge ?? profile.deliveryPricePerKm ?? 0,
                  })}
                </Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.pickupRow, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}26` }]}>
              <View style={[styles.pickupIcon, { backgroundColor: `${colors.primary}1F` }]}>
                <FontAwesome6 name="store" size={13} color={colors.primary} solid />
              </View>
              <Text style={[styles.pickupText, { color: colors.text }]} numberOfLines={2}>
                {t('myInfo.pickupOnly')}
              </Text>
            </View>
          )
        }
        highlights={{ title: t('myInfo.whatISell'), items: kinds }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {profile.shopPhotoUrls.length > 0 ? (
          <ProfileSection icon="images" title={t('myInfo.shopPhotos')} count={profile.shopPhotoUrls.length}>
            <Gallery urls={profile.shopPhotoUrls} onOpen={(index) => setViewer({ photos: profile.shopPhotoUrls, index })} />
          </ProfileSection>
        ) : null}
        <WorkerReviewsSection
          summary={reviews.data}
          loading={reviews.isLoading}
          error={reviews.isError}
          title={t('shopOrders.shopReviewsTitle', { shop: profile.shopName })}
        />
      </ProfileCover>
      <PhotoViewer photos={viewer?.photos ?? []} startIndex={viewer ? viewer.index : null} onClose={() => setViewer(null)} />
    </View>
  );
}

/** The job post as customers see it under Hire Staff, with Live / Hidden and Edit. */
function JobInfo({ navigation, postId }: { navigation: MyInfoNavigation; postId?: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const account = useAuthStore((state) => state.account);
  const posts = useMyJobPosts();
  const isLoading = posts.isLoading;
  const post = (posts.data ?? []).find((entry) => entry.id === postId) ?? (postId ? null : (posts.data ?? [])[0] ?? null);
  const trustedIds = useTrustedProfileIds();
  const [viewer, setViewer] = useState<string | null>(null);
  const [viewsOpen, setViewsOpen] = useState(false);
  // The post is gone (deleted from its edit screen): back to where they came from.
  useEffect(() => {
    if (!isLoading && !post) navigation.goBack();
  }, [isLoading, post, navigation]);

  if (isLoading || !post) return <LoadingView />;
  const name = account?.fullName ?? '';
  const place = placeName(post.locationAddress);
  const work: { label: string; icon: IconName }[] = [
    { label: jobTitle(post, t), icon: categoryIcon(post.category) as IconName },
    ...post.skills.map((skill) => ({ label: skill, icon: 'star' as IconName })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ProfileCover
        topInset={insets.top}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        right={<EditButton label={t('common.edit')} onPress={() => navigation.navigate('JobPost', { postId: post.id })} />}
        avatar={
          <Avatar
            photoUrl={post.photoUrl}
            label={name}
            trusted={trustedIds.has(post.id)}
            onOpen={() => post.photoUrl && setViewer(post.photoUrl)}
          />
        }
        name={name}
        subtitle={jobTitle(post, t)}
        kicker={{ icon: 'briefcase', label: t('myInfo.kickerJob') }}
        pills={
          <>
            <ProfilePill
              icon={post.isActive ? 'circle-check' : 'eye-slash'}
              label={t(post.isActive ? 'jobPost.statusLive' : 'jobPost.statusHidden')}
              color={post.isActive ? '#16A34A' : colors.textMuted}
            />
            {place ? <ProfilePill icon="location-dot" label={place} /> : null}
          </>
        }
        stats={[
          { icon: 'indian-rupee-sign', value: formatRupees(post.payAmount), label: t(`jobPost.per.${post.payPeriod}`), gold: true },
          { icon: 'clock', value: t(`jobPost.availability.${post.availability}`), label: t('jobPost.availabilityLabel') },
          { icon: 'briefcase', value: t('jobPost.years', { count: post.experienceYears }), label: t('jobPost.experienceLabel') },
        ]}
        highlights={{ title: t('myInfo.workAndSkills'), items: work }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <ProfileSection icon="eye" title={t('jobViews.title')}>
          <JobPostViewsCard post={post} onPress={() => setViewsOpen(true)} showNew />
        </ProfileSection>
        {post.description ? (
          <ProfileSection icon="quote-left" title={t('jobPost.aboutLabel')}>
            <Text style={[styles.about, { color: colors.text }]}>{post.description}</Text>
          </ProfileSection>
        ) : null}
      </ProfileCover>
      <PhotoViewer photos={viewer ? [viewer] : []} startIndex={viewer ? 0 : null} onClose={() => setViewer(null)} />
      <JobPostViewersSheet postId={viewsOpen ? post.id : null} title={jobTitle(post, t)} onClose={() => setViewsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  about: { ...typography.body, fontSize: 14, lineHeight: 21 },
  flex: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 30, lineHeight: 38 },
  coverButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryRow: { gap: 10, paddingRight: 4 },
  galleryImage: { width: 180, height: 136, borderRadius: 16 },
  deliveryBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, marginTop: 14, overflow: 'hidden' },
  deliveryGlow: { position: 'absolute', width: 110, height: 110, borderRadius: 55, top: -50, right: -30, backgroundColor: 'rgba(255,255,255,0.16)' },
  deliveryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 20 },
  deliveryCharges: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  deliveryChargeText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16 },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 10, marginTop: 14 },
  pickupIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pickupText: { ...typography.body, fontSize: 13.5, flex: 1 },
});
