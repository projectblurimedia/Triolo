import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '@/components/ScreenContainer';
import { PullToRefresh } from '@/components/PullToRefresh';
import { ProfileGrowth } from '@/components/ProfileGrowth';
import { useMyBadges, useMySubscription } from '@/hooks/useSubscription';
import { fonts, typography, useThemeColors } from '@/theme';

/**
 * Grow tab: everything that gets a partner more work in one place — Partner Plus (jobs first,
 * top of lists, who viewed you, no ads), each profile's Trusted by Triolo badge, and Boost
 * (a profile shown to customers as an ad). Notifications stay under the header's bell.
 */
export function GrowScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const subscription = useMySubscription();
  const badges = useMyBadges();
  const [refreshing, setRefreshing] = useState(false);
  const nothing = !subscription.data?.enabled && (badges.data?.profiles ?? []).length === 0 && !badges.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['subscription'] }),
      queryClient.invalidateQueries({ queryKey: ['boosts'] }),
    ]).finally(() => setRefreshing(false));
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <Text style={[styles.intro, { color: colors.textMuted }]}>{t('grow.intro')}</Text>
          <ProfileGrowth />
          {nothing ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
                <FontAwesome6 name="rocket" size={22} color={colors.primary} solid />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('grow.emptyTitle')}</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('grow.emptyMessage')}</Text>
            </View>
          ) : null}
        </ScrollView>
      </PullToRefresh>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 120 },
  intro: { ...typography.body, lineHeight: 21 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold },
  emptyText: { ...typography.body, textAlign: 'center', paddingHorizontal: 24 },
});
