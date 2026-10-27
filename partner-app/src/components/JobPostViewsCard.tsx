import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { JobPost } from '@/services/jobSeekerService';
import { fonts, headerGradient, typography } from '@/theme';

/**
 * A job post's visits as one bright card — how many opened it and "See who viewed" — that opens
 * the viewers sheet. `showNew` adds a "3 new" pill (Home); Activity leaves it off, since it is
 * a record, not an alert.
 */
export function JobPostViewsCard({ post, onPress, showNew = false }: { post: JobPost; onPress: () => void; showNew?: boolean }) {
  const { t } = useTranslation();
  const fresh = showNew ? (post.newViews ?? 0) : 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.wrap, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <FontAwesome6 name="eye" size={64} color="rgba(255,255,255,0.1)" solid style={styles.watermark} />
        <View style={styles.icon}>
          <FontAwesome6 name="users-viewfinder" size={17} color="#FFFFFF" solid />
        </View>
        <View style={styles.flex}>
          <Text style={styles.value}>{t('jobViews.visits', { count: post.viewCount ?? 0 })}</Text>
          <Text style={styles.text} numberOfLines={1}>
            {t('jobViews.seeWhoLong')}
          </Text>
        </View>
        {fresh > 0 ? (
          <View style={styles.newPill}>
            <Text style={styles.newText}>{t('jobViews.newCount', { count: fresh })}</Text>
          </View>
        ) : null}
        <View style={styles.go}>
          <FontAwesome6 name="chevron-right" size={12} color="#FFFFFF" solid />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { borderRadius: 18, overflow: 'hidden' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, overflow: 'hidden' },
  watermark: { position: 'absolute', right: 34, bottom: -16 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16, color: '#FFFFFF', lineHeight: 21 },
  text: { ...typography.caption, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  newPill: { borderRadius: 11, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#FFFFFF' },
  newText: { fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 15, color: '#DC2626' },
  go: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
});
