import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { GlassPanel } from './GlassPanel';
import { ANDROID_REAL_BLUR } from '@/state/blurTargetStore';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VerificationBadge } from './VerificationBadge';
import { PhotoViewer } from './PhotoViewer';
import { initialsOf, WorkerProfileFacts, WorkerReviewsSection } from './WorkerProfileGlass';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { BusinessNearbyResult } from '@/services/businessesService';
import { WorkerNearbyResult } from '@/services/workersService';
import { useBusinessReviews, useWorkerReviews } from '@/hooks/useReviews';
import { useFavoriteToggle } from '@/hooks/useFavorites';
import { Button } from './Button';
import { RatingStars } from './RatingStars';
import { SendListModal } from './SendListModal';
import { formatAddress } from '@/utils/formatAddress';
import { formatDistanceValue, isWorkerResult, NearbyResult, NearbySearchMode } from '@/utils/nearbyResult';
import { COMPACT_AVATAR_SIZE, GlassProfileLayout, GlassHeroButton } from './GlassHero';
import { firstName } from '@/utils/firstName';
import { SmartImage } from './SmartImage';

interface NearbyResultDetailModalProps {
  visible: boolean;
  onClose: () => void;
  mode: NearbySearchMode;
  result: NearbyResult | null;
}

/**
 * A worker's or shop's full profile, opened from any nearby card (Home, Services, search).
 *
 * A worker gets the glassy profile: gradient hero with rating / rated jobs / experience
 * tiles, their work photos (tap for the full-screen, swipe-through viewer), skills, address,
 * and the customers' ratings breakdown and written reviews (GET /reviews/workers/:id). A shop
 * keeps the simpler layout. Always the brand blue, never the Business orange, on this surface.
 */
export function NearbyResultDetailModal({ visible, onClose, mode, result }: NearbyResultDetailModalProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [stickyVisible, setStickyVisible] = useState(false);
  const stickyVisibleRef = useRef(false);
  const blurTargetRef = useRef<View>(null);

  // Each opened profile starts at the top, with the sticky bar hidden.
  useEffect(() => {
    if (!visible) return;
    scrollY.setValue(0);
    stickyVisibleRef.current = false;
    setStickyVisible(false);
  }, [visible, result, scrollY]);
  const worker = result && isWorkerResult(mode, result) ? result : null;
  const reviews = useWorkerReviews(visible && worker ? worker.id : null);
  const shopId = result && !worker ? result.id : null;
  const shopReviews = useBusinessReviews(visible ? shopId : null);
  const favorite = useFavoriteToggle(worker ? 'worker' : 'business', result?.id ?? null);
  const [orderVisible, setOrderVisible] = useState(false);

  if (!result) {
    return null;
  }

  const business = !worker ? (result as BusinessNearbyResult) : null;
  const photos = worker ? worker.portfolioPhotoUrls : (business as BusinessNearbyResult).shopPhotoUrls;
  const fixedTags = worker
    ? worker.skillCategories.filter((key) => key !== 'other')
    : (business as BusinessNearbyResult).shopCategories.filter((key) => key !== 'other');
  const customTags = worker
    ? (worker.otherSkillDescription?.split(', ').filter(Boolean) ?? [])
    : ((business as BusinessNearbyResult).otherCategoryDescription?.split(', ').filter(Boolean) ?? []);
  const tagLabels = [
    ...fixedTags.map((key) => t(worker ? `workerProfile.skills.${key}` : `businessProfile.categories.${key}`)),
    ...customTags,
  ];
  const distance = t('nearbySearch.distanceAway', {
    distance: formatDistanceValue(result.distanceMeters),
  });

  // Save to (or remove from) the customer's favorites.
  const heartButton = (
    <GlassHeroButton
      icon="heart"
      onPress={favorite.toggle}
      disabled={favorite.pending}
      solid={favorite.saved}
      active={favorite.saved}
      accessibilityLabel={t(favorite.saved ? 'favorites.remove' : 'favorites.save')}
    />
  );

  const renderGallery = () =>
    photos.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryContent}>
        {photos.map((url, index) => (
          <Pressable key={url} onPress={() => setViewerIndex(index)}>
            <SmartImage source={{ uri: url }} style={styles.galleryImage} />
            {index === 0 && photos.length > 1 ? (
              <View style={styles.photoCount}>
                <FontAwesome6 name="images" size={10} color="#FFFFFF" solid />
                <Text style={styles.photoCountText}>{photos.length}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    ) : null;

  const renderInfoRow = (icon: React.ComponentProps<typeof FontAwesome6>['name'], text: string) => (
    <View style={styles.infoRow}>
      <View style={[styles.infoIconBadge, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={icon} size={14} color={colors.primary} solid />
      </View>
      <Text style={[styles.infoText, { color: colors.text }]}>{text}</Text>
    </View>
  );

  const renderWorker = (w: WorkerNearbyResult) => (
    <>
      <GlassProfileLayout
        topInset={insets.top}
        onBack={onClose}
        backLabel={t('common.cancel')}
        avatar={
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.compactAvatar}>
            <Text style={styles.compactInitials}>{initialsOf(w.accountFullName)}</Text>
          </LinearGradient>
        }
        title={firstName(w.accountFullName)}
        subtitle={distance}
        right={heartButton}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
      >
        <WorkerProfileFacts
          skills={tagLabels}
          ratingAverage={w.ratingAverage}
          ratingCount={w.ratingCount}
          experienceYears={w.experienceYears}
          badge={
            <View style={styles.nameBlock}>
              <Text style={[styles.fullName, { color: colors.text }]}>{w.accountFullName}</Text>
              <VerificationBadge status={w.verificationStatus} />
            </View>
          }
        />
        {photos.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('workerReviews.workPhotos')}</Text>
            {renderGallery()}
          </>
        ) : null}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {renderInfoRow('location-dot', formatAddress(w))}
        </View>
        <WorkerReviewsSection summary={reviews.data} loading={reviews.isLoading} error={reviews.isError} />
      </GlassProfileLayout>
    </>
  );

  const renderBusiness = (b: BusinessNearbyResult) => (
    <>
      <GlassProfileLayout
        topInset={insets.top}
        onBack={onClose}
        backLabel={t('common.cancel')}
        avatar={
          b.shopPhotoUrls[0] ? (
            <SmartImage source={{ uri: b.shopPhotoUrls[0] }} style={styles.compactAvatar} />
          ) : (
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.compactAvatar}>
              <FontAwesome6 name="store" size={19} color="#FFFFFF" solid />
            </LinearGradient>
          )
        }
        title={b.shopName}
        titleLines={2}
        subtitle={distance}
        right={heartButton}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 110 }]}
      >
        <View style={[styles.card, styles.shopFacts, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <RatingStars average={b.ratingAverage} count={b.ratingCount} variant="full" />
          <VerificationBadge status={b.verificationStatus} />
        </View>
        {photos.length > 0 ? (
          renderGallery()
        ) : (
          <View style={styles.heroPlaceholderWrap}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroPlaceholder}>
              <FontAwesome6 name="store" size={36} color="#FFFFFF" solid />
            </LinearGradient>
          </View>
        )}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('nearbySearch.detailCategoriesLabel')}</Text>
          <View style={styles.tagRow}>
            {tagLabels.map((label) => (
              <View key={label} style={[styles.tag, { backgroundColor: `${colors.primary}14` }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {renderInfoRow('truck', t(b.deliveryAvailable ? 'bazaar.deliveryAvailableYes' : 'bazaar.deliveryAvailableNo'))}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {renderInfoRow('location-dot', formatAddress(b))}
        </View>
        <WorkerReviewsSection summary={shopReviews.data} loading={shopReviews.isLoading} error={shopReviews.isError} />
      </GlassProfileLayout>
      {/* Send the prepared list to this shop. */}
      <View
        style={[
          styles.orderBar,
          { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        <Button label={t('sendList.orderFromShop')} onPress={() => setOrderVisible(true)} />
      </View>
      <SendListModal visible={orderVisible} onClose={() => setOrderVisible(false)} shop={b} onLeave={onClose} />
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {worker ? renderWorker(worker) : renderBusiness(business as BusinessNearbyResult)}
        <PhotoViewer photos={photos} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      </View>
    </Modal>
  );
}

// The sticky bar fades in over this scroll range — roughly as the hero's name passes under it.
const STICKY_START = 140;
const STICKY_END = 220;

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  sticky: { position: 'absolute', top: 0, left: 0, right: 0 },
  orderBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Roomy bar under the status bar: back, avatar, name and rating.
  stickyGlass: { paddingBottom: 16, paddingHorizontal: 16 },
  stickyBorder: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
  stickyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stickyBack: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stickyAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  stickyAvatarText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 15 },
  stickyName: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 23 },
  stickyMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stickyMetaText: { ...typography.caption, fontSize: 12 },
  nameBlock: { alignSelf: 'stretch', gap: 8 },
  fullName: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 27 },
  factsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', gap: 10 },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  distancePillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  compactAvatar: {
    width: COMPACT_AVATAR_SIZE,
    height: COMPACT_AVATAR_SIZE,
    borderRadius: COMPACT_AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInitials: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 17 },
  shopFacts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  shopAvatar: { width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  shopName: { fontFamily: fonts.semiBold, fontSize: 21, lineHeight: 28, marginTop: 12, textAlign: 'center' },
  shopMeta: { ...typography.caption, marginTop: 2 },
  shopBadges: { alignItems: 'center', gap: 8, marginTop: 10 },
  heroFlush: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleGroup: { marginLeft: 14, flex: 1 },
  headerTitle: {
    ...typography.subheading,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 14,
    marginTop: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    ...typography.subheading,
    fontFamily: fonts.semiBold,
    marginBottom: 12,
  },
  galleryContent: { gap: 10, paddingBottom: 4 },
  galleryImage: { width: 180, height: 140, borderRadius: 16 },
  photoCount: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  heroPlaceholderWrap: { alignItems: 'center', marginBottom: 4 },
  heroPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16 },
  cardLabel: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { ...typography.body, flex: 1 },
  divider: { height: 1, marginVertical: 14 },
});
