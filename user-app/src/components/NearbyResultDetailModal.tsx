import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VerificationBadge } from './VerificationBadge';
import { RatingStars } from './RatingStars';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { BusinessNearbyResult } from '@/services/businessesService';
import { formatAddress } from '@/utils/formatAddress';
import { formatDistanceValue, isWorkerResult, NearbyResult, NearbySearchMode } from '@/utils/nearbyResult';

interface NearbyResultDetailModalProps {
  visible: boolean;
  onClose: () => void;
  mode: NearbySearchMode;
  result: NearbyResult | null;
}

/**
 * Opened by tapping a card in `NearbySearchModal`'s result list — a fuller, read-only
 * view of that Worker/Business profile than the card can show (every skill/category tag
 * instead of a truncated row, the full photo set, the complete formatted address), per
 * explicit request that tapping a result should show its details "briefly, neat,
 * attractive" rather than nothing. Same full-screen gradient-header chrome as
 * `ComingSoonModal`/`NearbySearchModal` itself, so it reads as another screen in the same
 * family rather than a bolted-on popup. No booking/contact action is offered here — that
 * flow doesn't exist yet (Worker/Business module remainders, Pending Modules 4/5); this is
 * purely a richer read of the same public profile data the card already had.
 *
 * Always the constant brand-blue `headerGradient`, never the orange `SHOP_GRADIENT`, in
 * both modes — an earlier pass used `SHOP_GRADIENT` for `'business'` mode here (header,
 * hero placeholder, tags, info-icon badges); removed per explicit follow-up instruction,
 * matching `NearbySearchModal`'s own long-standing "never orange" rule for this surface.
 */
export function NearbyResultDetailModal({ visible, onClose, mode, result }: NearbyResultDetailModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const isWorker = mode === 'worker';
  const gradient = headerGradient;

  if (!result) {
    return null;
  }

  const worker = isWorkerResult(mode, result) ? result : null;
  const business = !worker ? (result as BusinessNearbyResult) : null;
  const title = worker ? worker.accountFullName : (business as BusinessNearbyResult).shopName;
  const photos = worker ? worker.portfolioPhotoUrls : (business as BusinessNearbyResult).shopPhotoUrls;
  const fixedTags = worker
    ? worker.skillCategories.filter((key) => key !== 'other')
    : (business as BusinessNearbyResult).shopCategories.filter((key) => key !== 'other');
  const customTags = worker
    ? worker.otherSkillDescription?.split(', ').filter(Boolean) ?? []
    : (business as BusinessNearbyResult).otherCategoryDescription?.split(', ').filter(Boolean) ?? [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('nearbySearch.distanceAway', { distance: formatDistanceValue(result.distanceMeters) })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryContent}>
              {photos.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.heroPlaceholderWrap}>
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroPlaceholder}>
                <FontAwesome6 name={isWorker ? 'screwdriver-wrench' : 'store'} size={36} color="#FFFFFF" solid />
              </LinearGradient>
            </View>
          )}

          <View style={styles.badgeRow}>
            <VerificationBadge status={result.verificationStatus} />
          </View>
          {worker ? (
            <View style={styles.badgeRow}>
              <RatingStars average={worker.ratingAverage} count={worker.ratingCount} variant="full" />
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
              {t(worker ? 'nearbySearch.detailSkillsLabel' : 'nearbySearch.detailCategoriesLabel')}
            </Text>
            <View style={styles.tagRow}>
              {fixedTags.map((key) => (
                <View key={key} style={[styles.tag, { backgroundColor: `${gradient[0]}14` }]}>
                  <Text style={[styles.tagText, { color: gradient[0] }]}>
                    {t(worker ? `workerProfile.skills.${key}` : `businessProfile.categories.${key}`)}
                  </Text>
                </View>
              ))}
              {customTags.map((entry) => (
                <View key={entry} style={[styles.tag, { backgroundColor: `${gradient[0]}14` }]}>
                  <Text style={[styles.tagText, { color: gradient[0] }]}>{entry}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {worker ? (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconBadge, { backgroundColor: `${gradient[0]}14` }]}>
                  <FontAwesome6 name="briefcase" size={14} color={gradient[0]} solid />
                </View>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  {t('services.experienceYears', { count: worker.experienceYears })}
                </Text>
              </View>
            ) : (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconBadge, { backgroundColor: `${gradient[0]}14` }]}>
                  <FontAwesome6 name="truck" size={14} color={gradient[0]} solid />
                </View>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  {t(
                    (business as BusinessNearbyResult).deliveryAvailable
                      ? 'bazaar.deliveryAvailableYes'
                      : 'bazaar.deliveryAvailableNo',
                  )}
                </Text>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.infoRow}>
              <View style={[styles.infoIconBadge, { backgroundColor: `${gradient[0]}14` }]}>
                <FontAwesome6 name="location-dot" size={14} color={gradient[0]} solid />
              </View>
              <Text style={[styles.infoText, { color: colors.text, flex: 1 }]}>{formatAddress(result)}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleGroup: { marginLeft: 14, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
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
  galleryContent: { gap: 10, paddingBottom: 4 },
  galleryImage: { width: 180, height: 140, borderRadius: 16 },
  heroPlaceholderWrap: { alignItems: 'center', marginBottom: 4 },
  heroPlaceholder: { width: 96, height: 96, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16 },
  cardLabel: { ...typography.caption, fontFamily: fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIconBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  infoText: { ...typography.body },
  divider: { height: 1, marginVertical: 14 },
});
