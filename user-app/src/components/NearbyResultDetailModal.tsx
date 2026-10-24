import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SealedAvatar, TrustedBadge } from './TrustedBadge';
import { PhotoViewer } from './PhotoViewer';
import { initialsOf, WorkerReviewsSection } from './WorkerProfileGlass';
import { BookWorkerModal } from './BookWorkerModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { BusinessNearbyResult } from '@/services/businessesService';
import { WorkerNearbyResult } from '@/services/workersService';
import { useBusinessReviews, useWorkerReviews } from '@/hooks/useReviews';
import { useFavoriteToggle } from '@/hooks/useFavorites';
import { Button } from './Button';
import { SendListModal } from './SendListModal';
import { ChooseListModal } from './ChooseListModal';
import { openNewList } from '@/navigation/navigationRef';
import { formatAddress } from '@/utils/formatAddress';
import { formatDistanceValue, isWorkerResult, NearbyResult, NearbySearchMode } from '@/utils/nearbyResult';
import { PROFILE_AVATAR_SIZE, ProfileCover, ProfilePill, ProfileSection } from './ProfileCover';
import { SHOP_CATEGORIES, SKILL_CATEGORIES } from '@/constants/categories';
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
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // The profile photo, opened on its own by tapping it in the header.
  const [avatarPhoto, setAvatarPhoto] = useState<string | null>(null);
  const worker = result && isWorkerResult(mode, result) ? result : null;
  const reviews = useWorkerReviews(visible && worker ? worker.id : null);
  const shopId = result && !worker ? result.id : null;
  const shopReviews = useBusinessReviews(visible ? shopId : null);
  const favorite = useFavoriteToggle(worker ? 'worker' : 'business', result?.id ?? null);
  // Order from this shop: pick a list first (orderListId null), then send it.
  const [orderVisible, setOrderVisible] = useState(false);
  const [orderListId, setOrderListId] = useState<string | null>(null);
  const [bookVisible, setBookVisible] = useState(false);

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
  const kinds = worker ? SKILL_CATEGORIES : SHOP_CATEGORIES;
  const tagItems = [
    ...fixedTags.map((key) => ({
      label: t(worker ? `workerProfile.skills.${key}` : `businessProfile.categories.${key}`),
      icon: (kinds.find((entry) => entry.key === key)?.icon ?? (worker ? 'screwdriver-wrench' : 'store')) as React.ComponentProps<typeof FontAwesome6>['name'],
    })),
    ...customTags.map((label) => ({ label, icon: (worker ? 'screwdriver-wrench' : 'tag') as React.ComponentProps<typeof FontAwesome6>['name'] })),
  ];
  const tagLabels = [
    ...fixedTags.map((key) => t(worker ? `workerProfile.skills.${key}` : `businessProfile.categories.${key}`)),
    ...customTags,
  ];
  const distance = t('nearbySearch.distanceAway', {
    distance: formatDistanceValue(result.distanceMeters),
  });

  // Save to (or remove from) the customer's favorites: a frosted round button on the blue cover.
  const heartButton = (
    <Pressable
      onPress={favorite.toggle}
      disabled={favorite.pending}
      hitSlop={8}
      accessibilityLabel={t(favorite.saved ? 'favorites.remove' : 'favorites.save')}
      style={[styles.coverButton, favorite.saved ? styles.coverButtonOn : null]}
    >
      <FontAwesome6 name="heart" size={16} color={favorite.saved ? '#F43F5E' : '#FFFFFF'} solid={favorite.saved} />
    </Pressable>
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

  /** The round photo for the cover: the picture, or initials / a shop icon on blue. */
  const renderAvatar = (photo: string | null | undefined, label: string, kind: 'service' | 'business', id: string) => (
    <Pressable
      onPress={() => photo && setAvatarPhoto(photo)}
      disabled={!photo}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
    >
      <SealedAvatar size={PROFILE_AVATAR_SIZE} kind={kind} id={id}>
        {photo ? (
          <SmartImage source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            {kind === 'business' ? (
              <FontAwesome6 name="store" size={34} color="#FFFFFF" solid />
            ) : (
              <Text style={styles.initials}>{initialsOf(label)}</Text>
            )}
          </LinearGradient>
        )}
      </SealedAvatar>
    </Pressable>
  );

  const place = formatAddress(result);
  const pills = (kind: 'service' | 'business') => (
    <>
      <TrustedBadge kind={kind} id={result.id} />
      <ProfilePill icon="location-arrow" label={distance} filled />
      {place ? <ProfilePill icon="location-dot" label={place} /> : null}
    </>
  );

  const renderWorker = (w: WorkerNearbyResult) => (
    <>
      <ProfileCover
        topInset={insets.top}
        onBack={onClose}
        backLabel={t('common.cancel')}
        right={heartButton}
        avatar={renderAvatar(w.profilePhotoUrl, w.accountFullName, 'service', w.id)}
        name={w.accountFullName}
        pills={pills('service')}
        kicker={{ icon: 'screwdriver-wrench', label: t('profileView.kickerWorker') }}
        highlights={{ title: t('profileView.workTheyDo'), items: tagItems }}
        stats={[
          {
            icon: 'star',
            value: w.ratingAverage != null ? w.ratingAverage.toFixed(1) : t('workerReviews.new'),
            label: t('workerReviews.statRating'),
            gold: true,
          },
          { icon: 'circle-check', value: String(w.ratingCount), label: t('workerReviews.statRatedJobs') },
          {
            icon: 'briefcase',
            value: t('workerReviews.experienceValue', { count: w.experienceYears }),
            label: t('workerReviews.statExperience'),
          },
        ]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {photos.length > 0 ? (
          <ProfileSection title={t('workerReviews.workPhotos')} icon="images" count={photos.length}>
            {renderGallery()}
          </ProfileSection>
        ) : null}
        <WorkerReviewsSection summary={reviews.data} loading={reviews.isLoading} error={reviews.isError} />
      </ProfileCover>
      {/* Book this worker personally — only they are asked. */}
      <View
        style={[
          styles.orderBar,
          { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: `${colors.primary}1F` },
        ]}
      >
        <Button
          label={t('directBook.button', { name: firstName(w.accountFullName) })}
          onPress={() => setBookVisible(true)}
        />
      </View>
      <BookWorkerModal
        worker={bookVisible ? w : null}
        onClose={() => setBookVisible(false)}
        onBooked={() => {
          // The tracker opens on top; this profile closes underneath it.
          setTimeout(() => {
            setBookVisible(false);
            onClose();
          }, 350);
        }}
      />
    </>
  );

  const renderBusiness = (b: BusinessNearbyResult) => (
    <>
      <ProfileCover
        topInset={insets.top}
        onBack={onClose}
        backLabel={t('common.cancel')}
        right={heartButton}
        avatar={renderAvatar(b.profilePhotoUrl, b.shopName, 'business', b.id)}
        name={b.shopName}
        pills={pills('business')}
        kicker={{ icon: 'store', label: t('profileView.kickerShop') }}
        highlights={{ title: t('profileView.whatTheySell'), items: tagItems }}
        beforeHighlights={
          b.deliveryAvailable ? (
            // One slim row: the truck, "Home delivery", and the charges on the right.
            <LinearGradient colors={DELIVERY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.deliveryBanner}>
              <View style={styles.deliveryGlow} />
              <View style={styles.deliveryBannerIcon}>
                <FontAwesome6 name="truck-fast" size={14} color="#FFFFFF" solid />
              </View>
              <Text style={[styles.deliveryBannerTitle, styles.flex]} numberOfLines={1}>
                {t('profileView.deliveryTitle')}
              </Text>
              {/* One line: "₹10 per km · Min ₹20". */}
              <View style={styles.deliveryCharges}>
                <Text style={styles.deliveryChargeValue} numberOfLines={1}>
                  {t('profileView.deliveryChargeLine', {
                    perKm: b.deliveryPricePerKm ?? 0,
                    min: b.deliveryMinCharge ?? b.deliveryPricePerKm ?? 0,
                  })}
                </Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.pickupRow, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}26` }]}>
              <View style={[styles.deliveryFactIcon, { backgroundColor: `${colors.primary}1F` }]}>
                <FontAwesome6 name="store" size={13} color={colors.primary} solid />
              </View>
              <Text style={[styles.pickupText, { color: colors.text }]} numberOfLines={2}>
                {t('profileView.pickupOnly')}
              </Text>
            </View>
          )
        }
        stats={[
          {
            icon: 'star',
            value: b.ratingAverage != null ? b.ratingAverage.toFixed(1) : t('workerReviews.new'),
            label: t('workerReviews.statRating'),
            gold: true,
          },
          { icon: 'users', value: String(b.ratingCount), label: t('profileView.ratings') },
          {
            icon: 'truck',
            value: t(b.deliveryAvailable ? 'profileView.deliversYes' : 'profileView.deliversNo'),
            label: t('profileView.delivery'),
          },
        ]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {photos.length > 0 ? (
          <ProfileSection title={t('profileView.shopPhotos')} icon="images" count={photos.length}>
            {renderGallery()}
          </ProfileSection>
        ) : null}
        <WorkerReviewsSection summary={shopReviews.data} loading={shopReviews.isLoading} error={shopReviews.isError} />
      </ProfileCover>
      {/* Send the prepared list to this shop. */}
      <View
        style={[
          styles.orderBar,
          { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: `${colors.primary}1F` },
        ]}
      >
        <Button
          label={t('sendList.orderFromShop')}
          onPress={() => {
            setOrderListId(null);
            setOrderVisible(true);
          }}
        />
      </View>
      <ChooseListModal
        visible={orderVisible && orderListId === null}
        shopName={b.shopName}
        onClose={() => setOrderVisible(false)}
        onPick={setOrderListId}
        onCreate={() => {
          setOrderVisible(false);
          onClose();
          openNewList();
        }}
      />
      <SendListModal
        visible={orderVisible && orderListId !== null}
        listId={orderListId}
        onClose={() => setOrderVisible(false)}
        shop={b}
        onLeave={onClose}
      />
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {worker ? renderWorker(worker) : renderBusiness(business as BusinessNearbyResult)}
        <PhotoViewer photos={photos} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
        <PhotoViewer photos={avatarPhoto ? [avatarPhoto] : []} startIndex={avatarPhoto ? 0 : null} onClose={() => setAvatarPhoto(null)} />
      </View>
    </Modal>
  );
}

// The sticky bar fades in over this scroll range — roughly as the hero's name passes under it.
const STICKY_START = 140;
const STICKY_END = 220;

const DELIVERY_GRADIENT = ['#15803D', '#22C55E'] as const;

const styles = StyleSheet.create({
  deliveryBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, marginTop: 14, overflow: 'hidden' },
  deliveryCharges: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  deliveryChargeValue: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16 },
  deliveryGlow: { position: 'absolute', width: 110, height: 110, borderRadius: 55, top: -50, right: -30, backgroundColor: 'rgba(255,255,255,0.16)' },
  deliveryBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryBannerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 20 },
  deliveryBannerText: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, marginTop: 1 },
  deliveryFacts: { flexDirection: 'row', gap: 10 },
  deliveryFact: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 10 },
  deliveryFactIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  deliveryFactValue: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 21 },
  deliveryFactLabel: { ...typography.caption, fontSize: 11 },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 10, marginTop: 14 },
  pickupText: { ...typography.body, fontSize: 13.5, flex: 1 },
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
  coverButtonOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  avatar: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 34, lineHeight: 42 },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  deliveryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12, marginTop: 16 },
  deliveryIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  deliveryText: { ...typography.body, fontSize: 13.5, flex: 1 },
  trustedCentre: { alignSelf: 'center' },
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
  nameBlock: { alignSelf: 'stretch', alignItems: 'center', gap: 8 },
  fullName: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 27, textAlign: 'center' },
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
  compactInitials: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 17 },
  // The first card under the compact header: no top margin of its own (the scroll already
  // clears the header); the gap goes below it, before the shop's photos.
  shopFacts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 0,
  },
  shopGallery: { marginTop: 20 },
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
  galleryImage: { width: 200, height: 150, borderRadius: 18 },
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
  // Space between the rating / verified card and the shop's photos below it.
  heroPlaceholderWrap: { alignItems: 'center', marginTop: 20, marginBottom: 4 },
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
  tag: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12 },
  tagText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
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
