import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { WorkerNearbyResult } from '@/services/workersService';
import { BusinessNearbyResult } from '@/services/businessesService';
import { formatAddress } from '@/utils/formatAddress';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { Avatar } from './WorkerMiniCard';
import { RatingStars } from './RatingStars';
import { HighlightText } from './HighlightText';

const MAX_TAGS = 3;

type SearchResultCardProps =
  | { kind: 'worker'; worker: WorkerNearbyResult; term?: string; onPress: () => void }
  | { kind: 'shop'; shop: BusinessNearbyResult; term?: string; onPress: () => void };

/**
 * One worker or shop in a search list (the search screen and Nearby Workers / Shops): photo with
 * the Trusted seal, name, the kinds of work / shop as chips, rating, experience or delivery, the
 * place, and the distance. The searched words are marked wherever they appear.
 */
export function SearchResultCard(props: SearchResultCardProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { term, onPress } = props;
  const isWorker = props.kind === 'worker';
  const item = isWorker ? props.worker : props.shop;
  const name = isWorker ? props.worker.accountFullName : props.shop.shopName;
  const fixed = isWorker
    ? props.worker.skillCategories.filter((key) => key !== 'other').map((key) => t(`workerProfile.skills.${key}`))
    : props.shop.shopCategories.filter((key) => key !== 'other').map((key) => t(`businessProfile.categories.${key}`));
  const custom = (isWorker ? props.worker.otherSkillDescription : props.shop.otherCategoryDescription)
    ?.split(', ')
    .filter(Boolean) ?? [];
  const tags = [...fixed, ...custom];
  // Matching chips first, so the reason it was found is always visible.
  const needle = term?.trim().toLowerCase() ?? '';
  const ordered = needle ? [...tags].sort((a, b) => Number(b.toLowerCase().includes(needle)) - Number(a.toLowerCase().includes(needle))) : tags;
  const shown = ordered.slice(0, MAX_TAGS);
  const more = ordered.length - shown.length;
  const place = formatAddress(item);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: `${colors.primary}1F`, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.top}>
        <Avatar
          photoUrl={item.profilePhotoUrl}
          name={name}
          size={54}
          seal={isWorker ? { kind: 'service', id: item.id } : { kind: 'business', id: item.id }}
        />
        <View style={styles.info}>
          <HighlightText text={name} term={term} style={[styles.name, { color: colors.text }]} numberOfLines={1} />
          <View style={styles.metaRow}>
            <RatingStars average={item.ratingAverage} count={item.ratingCount} />
            {isWorker ? (
              <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                {t('services.experienceShort', { count: props.worker.experienceYears })}
              </Text>
            ) : props.shop.deliveryAvailable ? (
              <View style={styles.inline}>
                <FontAwesome6 name="truck" size={10} color={colors.success} solid />
                <Text style={[styles.meta, { color: colors.success }]} numberOfLines={1}>
                  {t('bazaar.deliveryAvailableYes')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.distance}>
          <FontAwesome6 name="location-arrow" size={10} color="#FFFFFF" solid />
          <Text style={[styles.distanceText, { color: '#FFFFFF' }]}>{formatDistanceValue(item.distanceMeters)}</Text>
        </LinearGradient>
      </View>

      {shown.length > 0 ? (
        <View style={styles.tags}>
          {shown.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.background, borderColor: `${colors.primary}1F` }]}>
              <HighlightText text={tag} term={term} style={[styles.tagText, { color: colors.text }]} numberOfLines={1} />
            </View>
          ))}
          {more > 0 ? (
            <View style={[styles.tag, { backgroundColor: `${colors.primary}12`, borderColor: 'transparent' }]}>
              <Text style={[styles.tagText, { color: colors.primary }]}>+{more}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: `${colors.primary}14` }]}>
        <FontAwesome6 name="location-dot" size={11} color={colors.textMuted} solid />
        <HighlightText text={place || '—'} term={term} style={[styles.place, { color: colors.textMuted }]} numberOfLines={1} />
        <Text style={[styles.view, { color: colors.primary }]}>{t('homeSearch.viewProfile')}</Text>
        <FontAwesome6 name="chevron-right" size={10} color={colors.primary} solid />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, minWidth: 0, gap: 4 },
  name: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { ...typography.caption, fontSize: 11, fontFamily: fonts.medium },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, borderRadius: 13, paddingHorizontal: 9, alignSelf: 'flex-start' },
  distanceText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { height: 26, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, justifyContent: 'center', maxWidth: 160 },
  tagText: { ...typography.caption, fontSize: 11, lineHeight: 14, fontFamily: fonts.medium },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 9, borderTopWidth: 1 },
  place: { ...typography.caption, fontSize: 11, flex: 1 },
  view: { ...typography.caption, fontSize: 11, fontFamily: fonts.semiBold },
});
