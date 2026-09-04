import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { VerificationBadge } from '@/components/VerificationBadge';
import { fonts, typography, useThemeColors } from '@/theme';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'MyInfo'>;

/**
 * Read-only for this app's first pass, per "just show my info for now" — edit/delete
 * (reusing the same `PATCH .../me/profile` endpoints user-app already calls) is a natural
 * follow-up once this lands, not built here since it wasn't asked for yet.
 */
export function MyInfoScreen({ route }: Props) {
  const { capability } = route.params;
  return capability === 'worker' ? <WorkerInfo /> : <BusinessInfo />;
}

function WorkerInfo() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: profile, isLoading } = useMyWorkerProfile();

  if (isLoading || !profile) {
    return <LoadingView />;
  }

  const otherEntries = profile.otherSkillDescription ? profile.otherSkillDescription.split(', ').filter(Boolean) : [];
  const fixedSkills = profile.skillCategories.filter((key) => key !== 'other');

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <VerificationBadge status={profile.verificationStatus} />

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('workerProfile.skillLabel')}</Text>
        <View style={styles.chipRow}>
          {fixedSkills.map((key) => (
            <View key={key} style={[styles.chip, { borderColor: colors.border }]}>
              <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`workerProfile.skills.${key}`)}</Text>
            </View>
          ))}
          {otherEntries.map((entry, index) => (
            <View key={`${entry}-${index}`} style={[styles.chip, { borderColor: colors.border }]}>
              <Text style={[styles.chipLabel, { color: colors.text }]}>{entry}</Text>
            </View>
          ))}
        </View>

        <InfoRow icon="briefcase" label={t('workerProfile.experienceLabel')} value={String(profile.experienceYears)} colors={colors} />
        <InfoRow icon="location-dot" label={t('location.addressLabel')} value={profile.locationAddress ?? '-'} colors={colors} />

        {profile.portfolioPhotoUrls.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('workerProfile.portfolioLabel')}</Text>
            <PhotoRow urls={profile.portfolioPhotoUrls} />
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function BusinessInfo() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: profile, isLoading } = useMyBusinessProfile();

  if (isLoading || !profile) {
    return <LoadingView />;
  }

  const otherEntries = profile.otherCategoryDescription ? profile.otherCategoryDescription.split(', ').filter(Boolean) : [];
  const fixedCategories = profile.shopCategories.filter((key) => key !== 'other');

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.shopName, { color: colors.text }]}>{profile.shopName}</Text>
        <VerificationBadge status={profile.verificationStatus} />

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('businessProfile.categoryLabel')}</Text>
        <View style={styles.chipRow}>
          {fixedCategories.map((key) => (
            <View key={key} style={[styles.chip, { borderColor: colors.border }]}>
              <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`businessProfile.categories.${key}`)}</Text>
            </View>
          ))}
          {otherEntries.map((entry, index) => (
            <View key={`${entry}-${index}`} style={[styles.chip, { borderColor: colors.border }]}>
              <Text style={[styles.chipLabel, { color: colors.text }]}>{entry}</Text>
            </View>
          ))}
        </View>

        <InfoRow
          icon="truck"
          label={t('businessProfile.deliveryLabel')}
          value={profile.deliveryAvailable ? t('businessProfile.deliveryYes') : t('businessProfile.deliveryNo')}
          colors={colors}
        />
        <InfoRow icon="location-dot" label={t('location.addressLabel')} value={profile.locationAddress ?? '-'} colors={colors} />

        {profile.shopPhotoUrls.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('businessProfile.photosLabel')}</Text>
            <PhotoRow urls={profile.shopPhotoUrls} />
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
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

interface InfoRowProps {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>['colors'];
}

function InfoRow({ icon, label, value, colors }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <FontAwesome6 name={icon} size={14} color={colors.textMuted} solid />
      <View style={styles.infoText}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function PhotoRow({ urls }: { urls: string[] }) {
  return (
    <View style={styles.photoRow}>
      {urls.map((url) => (
        <Image key={url} source={{ uri: url }} style={styles.photo} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingVertical: 20, paddingBottom: 40 },
  shopName: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 20, marginBottom: 6 },
  sectionLabel: { ...typography.caption, marginTop: 20, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  chipLabel: { ...typography.caption, fontFamily: fonts.medium },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18 },
  infoText: { flex: 1 },
  infoLabel: { ...typography.caption },
  infoValue: { ...typography.body, fontFamily: fonts.medium, marginTop: 2 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: 72, height: 72, borderRadius: 10 },
});
