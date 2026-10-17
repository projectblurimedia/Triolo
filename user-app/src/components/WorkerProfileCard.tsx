import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { VerificationBadge } from './VerificationBadge';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { WorkerProfile } from '@/services/workersService';
import { formatAddress } from '@/utils/formatAddress';
import { SmartImage } from './SmartImage';

interface WorkerProfileCardProps {
  profile: WorkerProfile;
}

/** Summary card shown at the top of the Services tab body once the account has a Worker profile — replaces the header edit pill, which appeared too late (after the profile query resolved) to feel intentional. */
export function WorkerProfileCard({ profile }: WorkerProfileCardProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const thumbnail = profile.profilePhotoUrl ?? profile.portfolioPhotoUrls[0];
  const fixedSkills = profile.skillCategories.filter((key) => key !== 'other');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        {thumbnail ? (
          <SmartImage source={{ uri: thumbnail }} style={styles.avatar} />
        ) : (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <FontAwesome6 name="screwdriver-wrench" size={20} color="#FFFFFF" solid />
          </LinearGradient>
        )}
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {t('services.myService')}
          </Text>
          <VerificationBadge status={profile.verificationStatus} />
        </View>
      </View>

      <View style={styles.chipRow}>
        {fixedSkills.map((key) => (
          <View key={key} style={[styles.chip, { backgroundColor: `${colors.primary}14` }]}>
            <Text style={[styles.chipText, { color: colors.primary }]}>{t(`workerProfile.skills.${key}`)}</Text>
          </View>
        ))}
        {profile.otherSkillDescription
          ? profile.otherSkillDescription.split(', ').map((entry) => (
              <View key={entry} style={[styles.chip, { backgroundColor: `${colors.primary}14` }]}>
                <Text style={[styles.chipText, { color: colors.primary }]} numberOfLines={1}>
                  {entry}
                </Text>
              </View>
            ))
          : null}
      </View>

      <View style={styles.metaRow}>
        <FontAwesome6 name="briefcase" size={12} color={colors.textMuted} solid />
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {t('services.experienceYears', { count: profile.experienceYears })}
        </Text>
      </View>
      {profile.city ? (
        <View style={styles.metaRow}>
          <FontAwesome6 name="location-dot" size={12} color={colors.textMuted} solid />
          <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
            {formatAddress(profile)}
          </Text>
        </View>
      ) : null}
      <View style={[styles.manageRow, { borderTopColor: colors.border }]}>
        <FontAwesome6 name="circle-info" size={11} color={colors.textMuted} solid />
        <Text style={[styles.manageText, { color: colors.textMuted }]}>{t('profile.manageWorkerInPartnerApp')}</Text>
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
