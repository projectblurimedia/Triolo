import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { VerificationBadge } from './VerificationBadge';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { BusinessProfile } from '@/services/businessesService';
import { formatAddress } from '@/utils/formatAddress';
import { SmartImage } from './SmartImage';

interface BusinessProfileCardProps {
  profile: BusinessProfile;
}

/** The account's own shop, shown on the Bazaar tab and Profile — information only; it's edited in the Partner app. Same blue as the Services tab's worker card. */
export function BusinessProfileCard({ profile }: BusinessProfileCardProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const thumbnail = profile.profilePhotoUrl;
  const fixedCategories = profile.shopCategories.filter((key) => key !== 'other');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        {thumbnail ? (
          <SmartImage source={{ uri: thumbnail }} style={styles.avatar} />
        ) : (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <FontAwesome6 name="store" size={20} color="#FFFFFF" solid />
          </LinearGradient>
        )}
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {profile.shopName}
          </Text>
          <VerificationBadge status={profile.verificationStatus} />
        </View>
      </View>

      <View style={styles.chipRow}>
        {fixedCategories.map((key) => (
          <View key={key} style={[styles.chip, { backgroundColor: `${colors.primary}14` }]}>
            <Text style={[styles.chipText, { color: colors.primary }]}>{t(`businessProfile.categories.${key}`)}</Text>
          </View>
        ))}
        {profile.otherCategoryDescription
          ? profile.otherCategoryDescription.split(', ').map((entry) => (
              <View key={entry} style={[styles.chip, { backgroundColor: `${colors.primary}14` }]}>
                <Text style={[styles.chipText, { color: colors.primary }]} numberOfLines={1}>
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
      {formatAddress(profile) ? (
        <View style={styles.metaRow}>
          <FontAwesome6 name="location-dot" size={12} color={colors.textMuted} solid />
          <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
            {formatAddress(profile)}
          </Text>
        </View>
      ) : null}
      <View style={[styles.manageRow, { borderTopColor: colors.border }]}>
        <FontAwesome6 name="circle-info" size={11} color={colors.textMuted} solid />
        <Text style={[styles.manageText, { color: colors.textMuted }]}>{t('profile.manageShopInPartnerApp')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 10,
  },
  manageText: { ...typography.caption, fontSize: 11.5, flex: 1 },
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
