import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { categoryIcon, formatPay, jobTitle } from './JobPostCard';
import { SmartImage } from './SmartImage';
import { useSetJobPostActive } from '@/hooks/useJobPost';
import { JobPost } from '@/services/jobSeekerService';
import { useAuthStore } from '@/state/authStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { MainStackParamList } from '@/navigation/types';
import { placeName } from '@/utils/formatAddress';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

/**
 * One job post as a single card — the same on Home and in Activity: photo, name and work, the
 * Live / Hidden switch, the pay, and the visits (bright, tap to see who). Tapping the card opens
 * the full profile.
 */
export function JobPostSummaryCard({ post, onViews }: { post: JobPost; onViews: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const account = useAuthStore((state) => state.account);
  const setActive = useSetJobPostActive();
  const live = post.isActive;
  const tone = live ? brandColors.success : colors.textMuted;
  const place = placeName(post.locationAddress);
  const fresh = post.newViews ?? 0;

  const toggle = (next: boolean) =>
    setActive.mutate(
      { id: post.id, isActive: next },
      {
        onSuccess: () => showToast({ variant: 'success', title: t(next ? 'jobPost.shownToast' : 'jobPost.hiddenToast') }),
        onError: (error) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
      },
    );

  return (
    <Pressable
      onPress={() => navigation.navigate('MyInfo', { capability: 'job', postId: post.id })}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: `${colors.primary}26`, opacity: pressed ? 0.94 : 1 }]}
    >
      <View style={styles.top}>
        {post.photoUrl ? (
          <SmartImage source={{ uri: post.photoUrl }} style={styles.photo} />
        ) : (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.photo}>
            <FontAwesome6 name={categoryIcon(post.category) as never} size={20} color="#FFFFFF" solid />
          </LinearGradient>
        )}
        <View style={styles.flex}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {account?.fullName ?? ''}
          </Text>
          <Text style={[styles.work, { color: colors.primary }]} numberOfLines={1}>
            {jobTitle(post, t)}
          </Text>
        </View>
        <View style={styles.switchBox}>
          <Switch
            value={live}
            onValueChange={toggle}
            disabled={setActive.isPending}
            trackColor={{ true: `${brandColors.success}88`, false: colors.border }}
            thumbColor={live ? brandColors.success : '#FFFFFF'}
          />
          <Text style={[styles.switchText, { color: tone }]}>{t(live ? 'jobPost.statusLive' : 'jobPost.statusHidden')}</Text>
        </View>
      </View>

      <View style={styles.basics}>
        <View style={[styles.basic, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}26` }]}>
          <FontAwesome6 name="indian-rupee-sign" size={12} color={colors.primary} solid />
          <View style={styles.flex}>
            <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
              {formatPay(post, t)}
            </Text>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t('jobPost.expectedPay')}</Text>
          </View>
        </View>
        {/* The visits stand out: bright blue, tap to see who. */}
        <Pressable onPress={onViews} style={({ pressed }) => [styles.visitsWrap, { opacity: pressed ? 0.9 : 1 }]}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.visits}>
            <View style={styles.visitsIcon}>
              <FontAwesome6 name="eye" size={11} color="#FFFFFF" solid />
            </View>
            <View style={styles.flex}>
              <Text style={styles.visitsValue} numberOfLines={1}>
                {t('jobViews.visits', { count: post.viewCount ?? 0 })}
              </Text>
              <Text style={styles.visitsLabel}>{t('jobViews.seeWho')}</Text>
            </View>
            {fresh > 0 ? (
              <View style={styles.newBadge}>
                <Text style={styles.newText}>{fresh}</Text>
              </View>
            ) : null}
          </LinearGradient>
        </Pressable>
      </View>

      <View style={[styles.foot, { borderTopColor: `${colors.primary}14` }]}>
        {place ? (
          <>
            <FontAwesome6 name="location-dot" size={11} color={colors.textMuted} solid />
            <Text style={[styles.place, { color: colors.textMuted }]} numberOfLines={1}>
              {place}
            </Text>
          </>
        ) : (
          <View style={styles.flex} />
        )}
        <Text style={[styles.full, { color: colors.primary }]}>{t('jobPost.viewFull')}</Text>
        <FontAwesome6 name="chevron-right" size={10} color={colors.primary} solid />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  work: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
  switchBox: { alignItems: 'center' },
  switchText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, lineHeight: 13, marginTop: -2 },
  basics: { flexDirection: 'row', gap: 8 },
  basic: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  value: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5, lineHeight: 18 },
  label: { ...typography.caption, fontSize: 10.5, lineHeight: 13 },
  visitsWrap: { flex: 1, borderRadius: 13, overflow: 'hidden' },
  visits: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  visitsIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  visitsValue: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5, lineHeight: 18, color: '#FFFFFF' },
  visitsLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, lineHeight: 13, color: 'rgba(255,255,255,0.88)' },
  newBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  newText: { fontFamily: fonts.semiBold, fontSize: 10.5, lineHeight: 14, color: '#DC2626' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, paddingTop: 9 },
  place: { ...typography.caption, fontSize: 12, flex: 1 },
  edit: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  editText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5 },
  full: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
});
