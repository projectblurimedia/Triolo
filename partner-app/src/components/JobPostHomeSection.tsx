import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { JobPostCard } from './JobPostCard';
import { LoadingIndicator } from './LoadingIndicator';
import { useMyJobPost } from '@/hooks/useJobPost';
import { MainStackParamList, MainTabParamList } from '@/navigation/types';
import { fonts, typography, useThemeColors } from '@/theme';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

/**
 * Home's "Job Post" side: the partner's own looking-for-work post (or an invitation to make
 * one), what customers see of it, and a shortcut to edit.
 */
export function JobPostHomeSection() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const navigation = useNavigation<HomeNavigation>();
  const { data: post, isLoading } = useMyJobPost();
  const open = () => navigation.navigate('JobPost');

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <LoadingIndicator size={32} dotSize={5} color={colors.primary} />
      </View>
    );
  }

  const row = (icon: string, label: string, value: string) => (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={icon as never} size={13} color={colors.primary} solid />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );

  return (
    <View>
      <JobPostCard post={post} onPress={open} />

      {post ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('jobPost.detailsTitle')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {row('clock', t('jobPost.availabilityLabel'), t(`jobPost.availability.${post.availability}`))}
            {row('briefcase', t('jobPost.experienceLabel'), t('jobPost.years', { count: post.experienceYears }))}
            {post.skills.length > 0 ? row('list-check', t('jobPost.skillsLabel'), post.skills.join(', ')) : null}
            {row('location-dot', t('jobPost.locationLabel'), post.locationAddress)}
          </View>
          <Pressable style={[styles.editButton, { borderColor: colors.primary }]} onPress={open}>
            <FontAwesome6 name="pen" size={13} color={colors.primary} solid />
            <Text style={[styles.editText, { color: colors.primary }]}>{t('jobPost.edit')}</Text>
          </Pressable>
        </>
      ) : null}

      <View style={[styles.tip, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}26` }]}>
        <FontAwesome6 name="circle-info" size={14} color={colors.primary} solid />
        <Text style={[styles.tipText, { color: colors.text }]}>{t('jobPost.homeTip')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { paddingVertical: 32, alignItems: 'center' },
  sectionTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 8, marginBottom: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...typography.caption, fontSize: 11 },
  rowValue: { ...typography.body, fontSize: 14, marginTop: 1 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    height: 46,
    marginTop: 14,
  },
  editText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  tip: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 22 },
  tipText: { ...typography.caption, fontSize: 12.5, lineHeight: 18, flex: 1 },
});
