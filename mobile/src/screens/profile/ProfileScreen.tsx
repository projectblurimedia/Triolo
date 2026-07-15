import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';

// Ratings/posts are placeholder content until the Worker/Business profile modules and
// ratings/reviews module exist (see .cloud/project-context.md) — shown for worker and
// business accounts only, since a plain user account has neither.
const PROFESSIONAL_ROLES = new Set(['worker', 'business_owner', 'business_staff']);

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const isProfessional = account ? PROFESSIONAL_ROLES.has(account.role) : false;
  const initial = account?.fullName?.trim().charAt(0).toUpperCase() ?? '?';

  return (
    <ScreenContainer edges={['left', 'right']}>
      {account ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
          <View style={styles.cardInfo}>
            <Text style={[styles.name, { color: colors.text }]}>{account.fullName}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{account.mobileNumber}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {account.role} · {account.status}
            </Text>
          </View>
        </View>
      ) : null}

      {isProfessional ? (
        <>
          <View style={[styles.ratingCard, { backgroundColor: colors.surface }]}>
            <FontAwesome5 name="star" size={22} color={colors.secondary} solid />
            <View style={styles.ratingInfo}>
              <Text style={[styles.ratingValue, { color: colors.text }]}>{t('profile.ratingValue')}</Text>
              <Text style={[styles.ratingCount, { color: colors.textMuted }]}>{t('profile.ratingCount')}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('profile.postsTitle')}</Text>
          <View style={styles.postsRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.postCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <FontAwesome5 name="image" size={20} color={colors.textMuted} solid />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.heading,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
  },
  cardInfo: { marginLeft: 14, flex: 1 },
  name: { ...typography.subheading, fontFamily: fonts.semiBold },
  meta: { ...typography.body, marginTop: 2 },
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  ratingInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  ratingValue: { ...typography.subheading, fontFamily: fonts.semiBold },
  ratingCount: { ...typography.caption },
  sectionTitle: { ...typography.body, fontFamily: fonts.medium, marginBottom: 10 },
  postsRow: { flexDirection: 'row', gap: 10 },
  postCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
