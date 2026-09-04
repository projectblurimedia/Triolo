import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { VerificationBadge } from './VerificationBadge';
import { SHOP_GRADIENT } from './BusinessProfileModal';
import { fonts, typography, useThemeColors } from '@/theme';
import { BusinessProfile } from '@/services/businessesService';

interface BusinessProfileCardProps {
  profile: BusinessProfile;
  onEdit: () => void;
}

/** Summary card shown at the top of the Bazaar tab body once the account has a Business profile — replaces the header edit pill, which appeared too late (after the profile query resolved) to feel intentional. */
export function BusinessProfileCard({ profile, onEdit }: BusinessProfileCardProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const thumbnail = profile.shopPhotoUrls[0];
  const fixedCategories = profile.shopCategories.filter((key) => key !== 'other');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.avatar} />
        ) : (
          <LinearGradient colors={SHOP_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <FontAwesome6 name="store" size={20} color="#FFFFFF" solid />
          </LinearGradient>
        )}
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {profile.shopName}
          </Text>
          <VerificationBadge status={profile.verificationStatus} />
        </View>
        <Pressable
          onPress={onEdit}
          style={[styles.editButton, { backgroundColor: `${SHOP_GRADIENT[0]}16` }]}
          accessibilityLabel={t('bazaar.editBusinessProfile')}
          hitSlop={8}
        >
          <FontAwesome6 name="pen" size={13} color={SHOP_GRADIENT[0]} solid />
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {fixedCategories.map((key) => (
          <View key={key} style={[styles.chip, { backgroundColor: `${SHOP_GRADIENT[0]}14` }]}>
            <Text style={[styles.chipText, { color: SHOP_GRADIENT[0] }]}>{t(`businessProfile.categories.${key}`)}</Text>
          </View>
        ))}
        {profile.otherCategoryDescription
          ? profile.otherCategoryDescription.split(', ').map((entry) => (
              <View key={entry} style={[styles.chip, { backgroundColor: `${SHOP_GRADIENT[0]}14` }]}>
                <Text style={[styles.chipText, { color: SHOP_GRADIENT[0] }]} numberOfLines={1}>
                  {entry}
                </Text>
              </View>
            ))
          : null}
      </View>

      <View style={styles.metaRow}>
        <FontAwesome6 name="truck" size={12} color={colors.textMuted} solid />
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {t(profile.deliveryAvailable ? 'bazaar.deliveryAvailableYes' : 'bazaar.deliveryAvailableNo')}
        </Text>
      </View>
      {profile.locationAddress ? (
        <View style={styles.metaRow}>
          <FontAwesome6 name="location-dot" size={12} color={colors.textMuted} solid />
          <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
            {profile.locationAddress}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, marginLeft: 12 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  editButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { ...typography.caption, fontFamily: fonts.medium },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { ...typography.caption, flex: 1 },
});
