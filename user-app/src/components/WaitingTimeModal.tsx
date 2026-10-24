import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from './Button';
import { LoadingIndicator } from './LoadingIndicator';
import { ToastHost } from './ToastHost';
import { apiClient } from '@/services/apiClient';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

export interface WaitTimes {
  quickBookMinutes: number;
  directMinutes: number;
  orderMinutes: number;
  /** Quick Order: its own time, separate from Quick Book. */
  quickOrderMinutes: number;
}

export const WAIT_TIMES_QUERY_KEY = ['account', 'waitTimes'];

/** The customer's saved waiting times (for the countdowns on waiting screens too). */
export function useWaitTimes(enabled = true) {
  return useQuery({
    queryKey: WAIT_TIMES_QUERY_KEY,
    queryFn: () => apiClient.get<WaitTimes>('/auth/me/wait-times', true),
    enabled,
    staleTime: 5 * 60_000,
  });
}
const DEFAULTS: WaitTimes = { quickBookMinutes: 15, quickOrderMinutes: 15, directMinutes: 1440, orderMinutes: 1440 };
// The same choices for each, in minutes: 5, 10, 15, 30 min, 1, 2, 3, 5 hours, 1 day.
const CHOICES = [5, 10, 15, 30, 60, 120, 180, 300, 1440];

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];
interface Section {
  field: keyof WaitTimes;
  icon: IconName;
  gradient: readonly [string, string];
  titleKey: string;
  hintKey: string;
  /** The choices, in minutes (within the server's limits). */
  options: number[];
}

const SECTIONS: Section[] = [
  {
    field: 'quickBookMinutes',
    icon: 'bolt',
    gradient: headerGradient,
    titleKey: 'waitTime.quickBook',
    hintKey: 'waitTime.quickBookHint',
    options: CHOICES,
  },
  {
    field: 'quickOrderMinutes',
    icon: 'bag-shopping',
    gradient: ['#0891B2', '#22D3EE'],
    titleKey: 'waitTime.quickOrder',
    hintKey: 'waitTime.quickOrderHint',
    options: CHOICES,
  },
  {
    field: 'directMinutes',
    icon: 'user-check',
    gradient: ['#7C3AED', '#A78BFA'],
    titleKey: 'waitTime.direct',
    hintKey: 'waitTime.directHint',
    options: CHOICES,
  },
  {
    field: 'orderMinutes',
    icon: 'basket-shopping',
    gradient: ['#DB2777', '#F472B6'],
    titleKey: 'waitTime.order',
    hintKey: 'waitTime.orderHint',
    options: CHOICES,
  },
];

/** "10 min", "5 hours", "1 day". */
export function formatWait(minutes: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return t('waitTime.days', { count: minutes / 1440 });
  if (minutes >= 60 && minutes % 60 === 0) return t('waitTime.hours', { count: minutes / 60 });
  return t('waitTime.minutes', { count: minutes });
}

/**
 * Profile menu → Waiting Time: how long each kind of request waits for a worker or shop to
 * answer before it ends by itself — Quick Book, a worker booked personally and a list sent to a
 * shop, each 5 min to 1 day (defaults: Quick Book 15 min, the other two 1 day). Saving applies at once, also to requests
 * already waiting (the server reads it live).
 */
export function WaitingTimeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const saved = useWaitTimes(visible);
  const [draft, setDraft] = useState<WaitTimes>(DEFAULTS);

  useEffect(() => {
    if (visible && saved.data) setDraft(saved.data);
  }, [visible, saved.data]);

  const save = useMutation({
    mutationFn: (times: WaitTimes) => apiClient.put<WaitTimes>('/auth/me/wait-times', times, true),
    onSuccess: (times) => {
      queryClient.setQueryData(WAIT_TIMES_QUERY_KEY, times);
      // Anything waiting now follows the new times: refresh what's on screen.
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast({ variant: 'success', title: t('waitTime.savedTitle'), message: t('waitTime.savedMessage') });
      onClose();
    },
    onError: (error) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
  });

  const changed =
    !!saved.data &&
    (saved.data.quickBookMinutes !== draft.quickBookMinutes ||
      saved.data.directMinutes !== draft.directMinutes ||
      saved.data.orderMinutes !== draft.orderMinutes ||
      saved.data.quickOrderMinutes !== draft.quickOrderMinutes);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.back')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.headerTitle}>{t('waitTime.title')}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('waitTime.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {saved.isLoading ? (
          <View style={styles.center}>
            <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={[styles.intro, { color: colors.textMuted }]}>{t('waitTime.intro')}</Text>
            {SECTIONS.map((section) => (
              <View key={section.field} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHead}>
                  <LinearGradient colors={section.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardIcon}>
                    <FontAwesome6 name={section.icon} size={15} color="#FFFFFF" solid />
                  </LinearGradient>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{t(section.titleKey)}</Text>
                    <Text style={[styles.cardHint, { color: colors.textMuted }]}>{t(section.hintKey)}</Text>
                  </View>
                  <Text style={[styles.current, { color: colors.primary }]}>{formatWait(draft[section.field], t)}</Text>
                </View>
                {/* One scrollable row of times. */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
                  {section.options.map((minutes) => {
                    const active = draft[section.field] === minutes;
                    return (
                      <Pressable
                        key={minutes}
                        onPress={() => setDraft((current) => ({ ...current, [section.field]: minutes }))}
                        accessibilityState={{ selected: active }}
                      >
                        {active ? (
                          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.option}>
                            <Text style={[styles.optionText, { color: '#FFFFFF' }]}>{formatWait(minutes, t)}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={[styles.option, styles.optionOff, { borderColor: colors.border, backgroundColor: colors.background }]}>
                            <Text style={[styles.optionText, { color: colors.text }]}>{formatWait(minutes, t)}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Button label={t('waitTime.save')} onPress={() => save.mutate(draft)} loading={save.isPending} disabled={!changed} />
        </View>
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: 20, gap: 14, paddingBottom: 32 },
  intro: { ...typography.body, fontSize: 13.5, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold },
  cardHint: { ...typography.caption, fontSize: 12, lineHeight: 16, marginTop: 1 },
  current: { ...typography.body, fontFamily: fonts.semiBold },
  options: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  option: { height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  optionOff: { borderWidth: 1 },
  optionText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5, includeFontPadding: false },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
