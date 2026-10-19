import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JOB_CATEGORIES, JobSeeker } from '@/services/jobSeekersService';
import { formatRupees } from '@/services/ordersService';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { callPhone } from '@/utils/tripLinks';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { COMPACT_AVATAR_SIZE, GlassProfileLayout } from './GlassHero';
import { firstName } from '@/utils/firstName';
import { SmartImage } from './SmartImage';
import { showAdBefore } from './Ads';

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
            <GlassProfileLayout
              topInset={insets.top}
              onBack={onClose}
              backLabel={t('common.close')}
              avatar={
                person.photoUrl ? (
                  <SmartImage source={{ uri: person.photoUrl }} style={styles.compactAvatar} />
                ) : (
                  <LinearGradient
                    colors={headerGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.compactAvatar}
                  >
                    <Text style={styles.compactInitials}>{initialsOf(person.fullName)}</Text>
                  </LinearGradient>
                )
              }
              title={firstName(person.fullName)}
              subtitle={jobSeekerTitle(person, t)}
              contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
            >
              {/* Pay, work and distance — the first thing a family wants to know. */}
              <View style={styles.bodyTop}>
                <Text style={[styles.fullName, { color: colors.text }]}>{person.fullName}</Text>
                <View style={[styles.payCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.flex}>
                    <Text style={[styles.payLabel, { color: colors.textMuted }]}>{t('hireStaff.expectedPay')}</Text>
                    <View style={styles.payRow}>
                      <Text style={[styles.pay, { color: colors.text }]}>{formatRupees(person.payAmount)}</Text>
                      <Text style={[styles.per, { color: colors.textMuted }]}> / {t(`hireStaff.per.${person.payPeriod}`)}</Text>
                    </View>
                  </View>
                  <View style={styles.payTags}>
                    <View
                      style={[styles.workPill, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}
                    >
                      <FontAwesome6 name={icon as never} size={11} color={colors.primary} solid />
                      <Text style={[styles.workText, { color: colors.primary }]} numberOfLines={1}>
                        {jobSeekerTitle(person, t)}
                      </Text>
                    </View>
                    <View style={styles.distance}>
                      <FontAwesome6 name="location-arrow" size={11} color={colors.primary} solid />
                      <Text style={[styles.distanceText, { color: colors.textMuted }]}>
                        {t('hireStaff.away', { distance: formatDistanceValue(person.distanceMeters) })}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.body}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {infoRow('clock', t('hireStaff.availabilityLabel'), t(`hireStaff.availability.${person.availability}`))}
                  {infoRow(
                    'briefcase',
                    t('hireStaff.experienceLabel'),
                    person.experienceYears > 0 ? t('hireStaff.years', { count: person.experienceYears }) : t('hireStaff.fresher'),
                  )}
                  {infoRow('location-dot', t('hireStaff.locationLabel'), person.locationAddress)}
                </View>

                {person.skills.length > 0 ? (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('hireStaff.skillsLabel')}</Text>
                    <View style={styles.skills}>
                      {person.skills.map((skill) => (
                        <View
                          key={skill}
                          style={[styles.skill, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}
                        >
                          <Text style={[styles.skillText, { color: colors.primary }]}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {person.description ? (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('hireStaff.aboutLabel')}</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[styles.about, { color: colors.text }]}>{person.description}</Text>
                    </View>
                  </>
                ) : null}
              </View>
            </GlassProfileLayout>

            <View
              style={[
                styles.footer,
                { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: colors.border },
              ]}
            >
              <View style={styles.flex}>
                <Text style={[styles.phoneLabel, { color: colors.textMuted }]}>{t('hireStaff.phoneLabel')}</Text>
                <Text style={[styles.phone, { color: colors.text }]} selectable>
                  {person.mobileNumber}
                </Text>
              </View>
              <Pressable
                onPress={() => showAdBefore(() => callPhone(person.mobileNumber))}
                accessibilityLabel={`${t('hireStaff.call')} ${person.fullName}`}
              >
                <LinearGradient colors={CALL_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.callButton}>
                  <FontAwesome6 name="phone" size={15} color="#FFFFFF" solid />
                  <Text style={styles.callText}>{t('hireStaff.callNow')}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  compactAvatar: {
    width: COMPACT_AVATAR_SIZE,
    height: COMPACT_AVATAR_SIZE,
    borderRadius: COMPACT_AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInitials: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 17 },
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
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 14 },
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
  phone: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 17, letterSpacing: 0.4 },
  callButton: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 24, borderRadius: 24 },
  callText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
