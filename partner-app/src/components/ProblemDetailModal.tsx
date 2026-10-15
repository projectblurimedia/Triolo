import React, { useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { PhotoViewer } from './PhotoViewer';
import { ToastHost } from './ToastHost';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { formatDistance } from '@/utils/formatDistance';
import { SmartImage } from './SmartImage';

/** What this screen needs — both a nearby (open) problem and an accepted one fit. */
export interface ProblemDetails {
  id: string;
  skillCategories: string[];
  description: string | null;
  quotationAmount: number;
  photoUrls: string[];
  locationAddress: string | null;
  distanceMeters?: number | null;
}

interface ProblemDetailModalProps {
  problem: ProblemDetails | null;
  onClose: () => void;
  /** Shown only for an open problem — omitted when viewing a job already accepted. */
  onAccept?: () => void;
  accepting?: boolean;
}

const GALLERY_HEIGHT = 260;

/**
 * A problem in full: swipeable photo gallery (tap a photo for the full-screen viewer),
 * quotation, needed skills, distance, address and description, plus Accept for an open
 * problem. Opened from Home's "Problems Near You" and from a problem job's screen.
 */
export function ProblemDetailModal({ problem, onClose, onAccept, accepting }: ProblemDetailModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const width = Dimensions.get('window').width;
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const photos = problem?.photoUrls ?? [];
  const skills = (problem?.skillCategories ?? []).map((key) => t(`workerProfile.skills.${key}`));

  const close = () => {
    setGalleryIndex(0);
    onClose();
  };

  const renderGallery = () =>
    photos.length > 0 ? (
      <View>
        <FlatList
          data={photos}
          keyExtractor={(url, index) => `${index}-${url}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setGalleryIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => setViewerIndex(index)} accessibilityLabel={t('problemDetail.viewPhoto')}>
              <SmartImage source={{ uri: item }} style={{ width, height: GALLERY_HEIGHT }} resizeMode="cover" />
            </Pressable>
          )}
        />
        <View style={styles.galleryBadge}>
          <FontAwesome6 name="expand" size={11} color="#FFFFFF" solid />
          <Text style={styles.galleryBadgeText}>
            {galleryIndex + 1} / {photos.length}
          </Text>
        </View>
        {photos.length > 1 ? (
          <View style={styles.galleryDots}>
            {photos.map((url, index) => (
              <View
                key={`${index}-${url}`}
                style={[styles.galleryDot, index === galleryIndex ? styles.galleryDotActive : null]}
              />
            ))}
          </View>
        ) : null}
      </View>
    ) : (
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.noPhotos}>
        <FontAwesome6 name="image" size={34} color="rgba(255,255,255,0.85)" />
        <Text style={styles.noPhotosText}>{t('problemDetail.noPhotos')}</Text>
      </LinearGradient>
    );

  const renderInfoRow = (icon: React.ComponentProps<typeof FontAwesome6>['name'], label: string, value: string) => (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={icon} size={14} color={colors.primary} solid />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={problem !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <Pressable style={styles.backButton} onPress={close} hitSlop={8} accessibilityLabel={t('common.close')}>
            <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t('problemDetail.title')}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {skills.join(', ')}
            </Text>
          </View>
        </LinearGradient>

        {problem ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: onAccept ? 120 : insets.bottom + 24 }}
          >
            {renderGallery()}

            <View style={styles.body}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={[styles.priceLabel, { color: colors.textMuted }]}>{t('problemDetail.quotation')}</Text>
                  <Text style={[styles.price, { color: colors.text }]}>₹{problem.quotationAmount.toLocaleString('en-IN')}</Text>
                </View>
                {problem.distanceMeters != null ? (
                  <View style={[styles.distancePill, { backgroundColor: `${colors.primary}14` }]}>
                    <FontAwesome6 name="location-arrow" size={12} color={colors.primary} solid />
                    <Text style={[styles.distanceText, { color: colors.primary }]}>
                      {t('problems.distanceAway', { distance: formatDistance(problem.distanceMeters) })}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.tags}>
                {skills.map((label) => (
                  <View
                    key={label}
                    style={[styles.tag, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}
                  >
                    <Text style={[styles.tagText, { color: colors.primary }]}>{label}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {problem.locationAddress
                  ? renderInfoRow('location-dot', t('problemDetail.location'), problem.locationAddress)
                  : null}
                {renderInfoRow(
                  'align-left',
                  t('problemDetail.description'),
                  problem.description?.trim() ? problem.description : t('problemDetail.noDescription'),
                )}
              </View>
            </View>
          </ScrollView>
        ) : null}

        {problem && onAccept ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: insets.bottom + 16, backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Button label={t('problems.accept')} onPress={onAccept} loading={accepting} />
          </View>
        ) : null}

        <PhotoViewer photos={photos} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  galleryBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  galleryBadgeText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12 },
  galleryDots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  galleryDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  galleryDotActive: { width: 18, backgroundColor: '#FFFFFF' },
  noPhotos: { height: 150, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noPhotosText: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.medium, fontSize: 13 },
  body: { padding: 18, gap: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { ...typography.caption },
  price: { fontFamily: fonts.semiBold, fontSize: 28, lineHeight: 36 },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  distanceText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 14 },
  infoRow: { flexDirection: 'row', gap: 12 },
  infoIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { ...typography.caption, fontSize: 11 },
  infoValue: { ...typography.body, fontSize: 14, lineHeight: 20, marginTop: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1 },
});
