import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
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
import { initialsOf, Stars, WorkerProfileHero, WorkerReviewsSection } from './WorkerProfileGlass';
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

  const backButton = (
    <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
      <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
    </Pressable>
  );

  // Save to (or remove from) the customer's favorites — light variant sits on the blue header.
  const heartButton = (light: boolean) => (
    <Pressable
      style={
        light
          ? styles.backButton
          : [styles.stickyBack, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}40` }]
      }
      onPress={favorite.toggle}
      disabled={favorite.pending}
      hitSlop={8}
      accessibilityLabel={t(favorite.saved ? 'favorites.remove' : 'favorites.save')}
    >
      <FontAwesome6
        name="heart"
        size={light ? 17 : 16}
        color={favorite.saved ? '#F43F5E' : light ? '#FFFFFF' : colors.primary}
        solid={favorite.saved}
      />
    </Pressable>
  );

  const renderGallery = () =>
    photos.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryContent}>
        {photos.map((url, index) => (
          <Pressable key={url} onPress={() => setViewerIndex(index)}>
            <Image source={{ uri: url }} style={styles.galleryImage} />
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

  // Frosted bar with the worker's avatar, name and rating — fades in once the big hero has
  // scrolled away, so who you're looking at stays visible (and Back stays reachable).
  const renderStickyHeader = (w: WorkerNearbyResult) => {
    const opacity = scrollY.interpolate({
      inputRange: [STICKY_START, STICKY_END],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    const translateY = scrollY.interpolate({
      inputRange: [STICKY_START, STICKY_END],
      outputRange: [-8, 0],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View
        pointerEvents={stickyVisible ? 'auto' : 'none'}
        style={[styles.sticky, { opacity, transform: [{ translateY }] }]}
      >
        <GlassPanel blurTarget={blurTargetRef} bordered={false} style={[styles.stickyGlass, { paddingTop: insets.top + 14 }]}>
          <View
            style={[
              styles.stickyBorder,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,85,211,0.10)',
              },
            ]}
          />
          <View style={styles.stickyRow}>
            <Pressable
              style={[styles.stickyBack, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}40` }]}
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel={t('common.cancel')}
            >
              <FontAwesome6 name="chevron-left" size={17} color={colors.primary} solid />
            </Pressable>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stickyAvatar}>
              <Text style={styles.stickyAvatarText}>{initialsOf(w.accountFullName)}</Text>
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={[styles.stickyName, { color: colors.text }]} numberOfLines={1}>
                {w.accountFullName}
              </Text>
              <View style={styles.stickyMeta}>
                {w.ratingAverage != null ? (
                  <>
                    <Stars value={w.ratingAverage} size={12} emptyColor={colors.border} />
                    <Text style={[styles.stickyMetaText, { color: colors.textMuted }]}>{w.ratingAverage.toFixed(1)}</Text>
                  </>
                ) : (
                  <Text style={[styles.stickyMetaText, { color: colors.textMuted }]}>{distance}</Text>
                )}
              </View>
            </View>
            {heartButton(false)}
          </View>
        </GlassPanel>
      </Animated.View>
    );
  };

  const renderWorker = (w: WorkerNearbyResult) => {
    const content = (
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const shown = event.nativeEvent.contentOffset.y > STICKY_END - 20;
            if (shown !== stickyVisibleRef.current) {
              stickyVisibleRef.current = shown;
              setStickyVisible(shown);
            }
          },
        })}
      >
        <WorkerProfileHero
          name={w.accountFullName}
          skills={tagLabels}
          ratingAverage={w.ratingAverage}
          ratingCount={w.ratingCount}
          experienceYears={w.experienceYears}
          subtitle={distance}
          badge={<VerificationBadge status={w.verificationStatus} />}
          topInset={insets.top}
          topLeft={backButton}
          topRight={heartButton(true)}
          style={styles.heroFlush}
        />
        <View style={styles.body}>
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
        </View>
      </Animated.ScrollView>
    );
    // The scroll content is the sticky bar's blur target (real blur on Android 12+).
    return ANDROID_REAL_BLUR ? (
      <BlurTargetView ref={blurTargetRef} style={styles.flex}>
        {content}
      </BlurTargetView>
    ) : (
      <View ref={blurTargetRef} style={styles.flex}>
        {content}
      </View>
    );
  };

  const renderBusiness = (b: BusinessNearbyResult) => (
    <>
      <LinearGradient
        colors={headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.headerRow}>
          {backButton}
          <View style={styles.titleGroup}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {b.shopName}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {distance}
            </Text>
          </View>
          {heartButton(true)}
        </View>
      </LinearGradient>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {photos.length > 0 ? (
          renderGallery()
        ) : (
          <View style={styles.heroPlaceholderWrap}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroPlaceholder}>
              <FontAwesome6 name="store" size={36} color="#FFFFFF" solid />
            </LinearGradient>
          </View>
        )}
        <View style={styles.badgeRow}>
          <VerificationBadge status={b.verificationStatus} />
        </View>
        <View style={styles.badgeRow}>
          <RatingStars average={b.ratingAverage} count={b.ratingCount} variant="full" />
        </View>
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
      </ScrollView>
      {/* Send the prepared list to this shop. */}
      <View
        style={[
          styles.orderBar,
          { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        <Button label={t('sendList.orderFromShop')} onPress={() => setOrderVisible(true)} />
      </View>
      <SendListModal visible={orderVisible} onClose={() => setOrderVisible(false)} shop={b} />
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {worker ? renderWorker(worker) : renderBusiness(business as BusinessNearbyResult)}
        {worker ? renderStickyHeader(worker) : null}
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
