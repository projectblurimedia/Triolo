import React, { useEffect, useState } from 'react';
import { placeName } from '@/utils/formatAddress';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JOB_CATEGORIES, JobSeeker, jobSeekersService } from '@/services/jobSeekersService';
import { formatRupees } from '@/services/ordersService';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { callStaff } from '@/utils/callStaff';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { PROFILE_AVATAR_SIZE, ProfileCover, ProfilePill, ProfileSection } from './ProfileCover';
import { usePayHint } from '@/hooks/useSubscription';
import { SmartImage } from './SmartImage';
import { SealedAvatar, TrustedBadge } from './TrustedBadge';
import { PhotoViewer } from './PhotoViewer';

const CALL_GRADIENT = ['#16A34A', '#22C55E'] as const;
const PHOTO_SIZE = 104;

/** What the person does: their own words for "other", else the category's name. */
export function jobSeekerTitle(person: Pick<JobSeeker, 'category' | 'title'>, t: (key: string) => string): string {
  return person.category === 'other' ? person.title : t(`hireStaff.categories.${person.category}`);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * One job seeker in full (opened from Hire Staff): photo, name and work, expected pay, how they
 * want to work, experience, skills, about, where they are, and their phone with a Call button.
 */
export function JobSeekerDetailModal({ person, onClose }: { person: JobSeeker | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  // The photo, opened on its own by tapping it in the header.
  const [photoOpen, setPhotoOpen] = useState(false);
  // The number, once paid for here (no plan).
  const [unlockedNumber, setUnlockedNumber] = useState<string | null>(null);
  useEffect(() => setUnlockedNumber(null), [person?.id]);
  // Opening a post counts as a visit the poster sees (never blocks or shows an error).
  useEffect(() => {
    if (person?.id) jobSeekersService.recordView(person.id).catch(() => {});
  }, [person?.id]);

  const number = unlockedNumber ?? person?.mobileNumber ?? null;
  // What seeing the number costs right now (null: free / already covered).
  const fee = usePayHint('staff_contact');
  const icon = person ? (JOB_CATEGORIES.find((entry) => entry.key === person.category)?.icon ?? 'user-tie') : 'user-tie';

  const infoRow = (rowIcon: string, label: string, value: string) => (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={rowIcon as never} size={14} color={colors.primary} solid />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={person !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {person ? (
          <>
            <ProfileCover
              topInset={insets.top}
              onBack={onClose}
              backLabel={t('common.close')}
              avatar={
                <Pressable
                  onPress={() => person.photoUrl && setPhotoOpen(true)}
                  disabled={!person.photoUrl}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={person.fullName}
                >
                  <SealedAvatar size={PROFILE_AVATAR_SIZE} kind="job_post" id={person.id}>
                    {person.photoUrl ? (
                      <SmartImage source={{ uri: person.photoUrl }} style={styles.avatar} />
                    ) : (
                      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                        <Text style={styles.initials}>{initialsOf(person.fullName)}</Text>
                      </LinearGradient>
                    )}
                  </SealedAvatar>
                </Pressable>
              }
              name={person.fullName}
              kicker={{ icon: 'user-tie', label: t('profileView.kickerStaff') }}
              highlights={{
                title: t('profileView.workAndSkills'),
                items: [
                  { label: jobSeekerTitle(person, t), icon: icon as React.ComponentProps<typeof FontAwesome6>['name'] },
                  ...person.skills.map((skill) => ({ label: skill, icon: 'star' as const })),
                ],
              }}
              subtitle={jobSeekerTitle(person, t)}
              pills={
                <>
                  <TrustedBadge kind="job_post" id={person.id} />
                  <ProfilePill icon="location-arrow" label={t('hireStaff.away', { distance: formatDistanceValue(person.distanceMeters) })} filled />
                  {placeName(person.locationAddress) ? <ProfilePill icon="location-dot" label={placeName(person.locationAddress)} /> : null}
                </>
              }
              stats={[
                { icon: 'indian-rupee-sign', value: formatRupees(person.payAmount), label: t(`hireStaff.per.${person.payPeriod}`), gold: true },
                { icon: 'clock', value: t(`hireStaff.availability.${person.availability}`), label: t('hireStaff.availabilityLabel') },
                {
                  icon: 'briefcase',
                  value: person.experienceYears > 0 ? t('hireStaff.years', { count: person.experienceYears }) : t('hireStaff.fresher'),
                  label: t('hireStaff.experienceLabel'),
                },
              ]}
              contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
            >
              {person.description ? (
                <ProfileSection title={t('hireStaff.aboutLabel')} icon="quote-left">
                  <Text style={[styles.about, { color: colors.text }]}>{person.description}</Text>
                </ProfileSection>
              ) : null}
            </ProfileCover>

            <View
              style={[
                styles.footer,
                { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: colors.border },
              ]}
            >
              {number ? (
                <View style={styles.flex}>
                  <Text style={[styles.phoneLabel, { color: colors.textMuted }]}>{t('hireStaff.phoneLabel')}</Text>
                  <Text style={[styles.phone, { color: colors.text }]} selectable numberOfLines={1}>
                    {number}
                  </Text>
                </View>
              ) : (
                <View style={[styles.flex, styles.hiddenRow]}>
                  <View style={[styles.lockIcon, { backgroundColor: `${colors.primary}14` }]}>
                    <FontAwesome6 name="lock" size={13} color={colors.primary} solid />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.hiddenTitle, { color: colors.text }]} numberOfLines={1}>
                      {t('hireStaff.numberHiddenTitle')}
                    </Text>
                    <Text style={[styles.phoneLabel, { color: colors.textMuted }]} numberOfLines={1}>
                      {fee ? t('hireStaff.payToSee') : t('hireStaff.tapToSee')}
                    </Text>
                  </View>
                </View>
              )}
              <Pressable
                onPress={() => callStaff({ id: person.id, mobileNumber: number }, setUnlockedNumber)}
                accessibilityLabel={`${t('hireStaff.call')} ${person.fullName}`}
              >
                <LinearGradient colors={CALL_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.callButton}>
                  <FontAwesome6 name="phone" size={15} color="#FFFFFF" solid />
                  <Text style={styles.callText} numberOfLines={1}>
                    {!number && fee ? t('hireStaff.payAmount') : t('hireStaff.callNow')}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
            <PhotoViewer
              photos={person.photoUrl ? [person.photoUrl] : []}
              startIndex={photoOpen ? 0 : null}
              onClose={() => setPhotoOpen(false)}
            />
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trusted: { marginTop: -6, marginBottom: 12 },
  avatar: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullName: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 27, marginBottom: 12 },
  bodyTop: { paddingHorizontal: 18 },
  payCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 16 },
  payLabel: { ...typography.caption, fontSize: 11 },
  payTags: { alignItems: 'flex-end', gap: 8 },
  container: { flex: 1 },
  flex: { flex: 1 },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  photoRing: { padding: 4, borderRadius: (PHOTO_SIZE + 8) / 2, borderWidth: 1 },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2 },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 34, lineHeight: 42 },
  name: { fontFamily: fonts.semiBold, fontSize: 22, lineHeight: 29, marginTop: 12, textAlign: 'center' },
  workPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 170,
  },
  workText: { fontFamily: fonts.semiBold, fontSize: 12 },
  payRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  pay: { fontFamily: fonts.semiBold, fontSize: 28, lineHeight: 36 },
  per: { fontFamily: fonts.regular, fontSize: 15 },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distanceText: { fontFamily: fonts.medium, fontSize: 12 },
  body: { padding: 18, paddingTop: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { ...typography.caption, fontSize: 11 },
  infoValue: { ...typography.body, fontSize: 14, marginTop: 1 },
  sectionTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 22, marginBottom: 12 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skill: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  skillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
  about: { ...typography.body, fontSize: 14, lineHeight: 21 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  phoneLabel: { ...typography.caption, fontSize: 11 },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  hiddenTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  phone: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 17, letterSpacing: 0.4 },
  callButton: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 20, borderRadius: 24 },
  callText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
