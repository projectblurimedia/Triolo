import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './Button';
import { LoadingIndicator } from './LoadingIndicator';
import { ToastHost } from './ToastHost';
import { BOOSTS_QUERY_KEY, useBoostInfo, useMyBoosts } from '@/hooks/useSubscription';
import { usePaymentReturn } from '@/hooks/usePaymentReturn';
import { BadgeKind, BOOST_DAYS, Boost, subscriptionsService } from '@/services/subscriptionsService';
import { useAuthStore } from '@/state/authStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDay } from '@/utils/formatDate';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

// The app's own blue, like every other main card.
const BOOST_GRADIENT = headerGradient;

interface BoostModalProps {
  /** The profile being boosted; null = closed. */
  profile: { kind: BadgeKind; name: string } | null;
  onClose: () => void;
}

/**
 * Boost one of my profiles: it's shown to customers nearby as an ad (their app shows the
 * profile card with Book Now / Order / Contact). Days and prices are the admin's ad plans;
 * it's paid on a Razorpay page and then checked by the Triolo team before it runs.
 */
export function BoostModal({ profile, onClose }: BoostModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const mobileNumber = useAuthStore((state) => state.account?.mobileNumber);
  const visible = !!profile;
  const info = useBoostInfo(visible);
  const boosts = useMyBoosts(visible);
  const [days, setDays] = useState<number>(7);
  const [busy, setBusy] = useState<string | null>(null);
  const { watch } = usePaymentReturn();

  useEffect(() => {
    if (visible) boosts.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const mine = (boosts.data ?? []).filter((boost) => boost.actionType === profile?.kind && boost.status !== 'deleted');
  const prices = info.data?.prices;
  const price = prices?.[String(days) as '1' | '3' | '7' | '30'] ?? 0;

  const check = async (id: string, quiet: boolean) => {
    try {
      const boost = await subscriptionsService.checkBoost(id);
      queryClient.invalidateQueries({ queryKey: BOOSTS_QUERY_KEY });
      if (boost.status !== 'unpaid') {
        showToast({ variant: 'success', title: t('boost.paidTitle'), message: t('boost.paidMessage') });
      } else if (!quiet) {
        showToast({ variant: 'info', title: t('subscribe.notPaidTitle'), message: t('subscribe.notPaidMessage') });
      }
    } catch (error) {
      if (!quiet) showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    }
  };

  const openPayment = async (id: string, url: string) => {
    watch(() => check(id, true));
    await Linking.openURL(url).catch(() => {});
  };

  const start = async () => {
    if (!profile || !mobileNumber) return;
    setBusy('new');
    try {
      const result = await subscriptionsService.startBoost(profile.kind, days, mobileNumber);
      queryClient.invalidateQueries({ queryKey: BOOSTS_QUERY_KEY });
      await openPayment(result.id, result.paymentUrl);
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      setBusy(null);
    }
  };

  const payAgain = async (boost: Boost) => {
    setBusy(boost.id);
    try {
      const link = await subscriptionsService.payBoost(boost.id);
      await openPayment(boost.id, link.paymentUrl);
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      setBusy(null);
    }
  };

  const statusColor = (status: Boost['status']) =>
    status === 'running' ? colors.success : status === 'rejected' ? colors.error : status === 'ended' ? colors.textMuted : colors.warning;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.back')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t('boost.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {profile?.name ?? ''}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {info.isLoading ? (
          <View style={styles.center}>
            <LoadingIndicator size={44} color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={BOOST_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroIcon}>
                <FontAwesome6 name="rocket" size={22} color="#FFFFFF" solid />
              </View>
              <Text style={styles.heroTitle}>{t('boost.heroTitle')}</Text>
              <Text style={styles.heroText}>{t('boost.heroText')}</Text>
            </LinearGradient>

            <Text style={[styles.section, { color: colors.text }]}>{t('boost.choose')}</Text>
            <View style={styles.plans}>
              {BOOST_DAYS.map((d) => {
                const selected = d === days;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDays(d)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.plan,
                      { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.planDays, { color: colors.textMuted }]}>{t('boost.days', { count: d })}</Text>
                    <Text style={[styles.planPrice, { color: colors.text }]}>₹{prices?.[String(d) as '1' | '3' | '7' | '30'] ?? '–'}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.note, { color: colors.textMuted }]}>{t('boost.note')}</Text>

            {mine.length > 0 ? (
              <>
                <Text style={[styles.section, { color: colors.text }]}>{t('boost.yours')}</Text>
                {mine.map((boost) => (
                  <View key={boost.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.flex}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>
                        {t('boost.days', { count: boost.planDays })} · ₹{boost.amount}
                      </Text>
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                        {formatDay(boost.startDate)} – {formatDay(boost.endDate)}
                        {boost.impressions > 0 ? ` · ${t('boost.views', { count: boost.impressions })}` : ''}
                      </Text>
                      {boost.status === 'rejected' && boost.reviewNote ? (
                        <Text style={[styles.rowMeta, { color: colors.error }]}>{boost.reviewNote}</Text>
                      ) : null}
                    </View>
                    {boost.status === 'unpaid' ? (
                      <Pressable onPress={() => payAgain(boost)} disabled={busy !== null} hitSlop={6} style={[styles.payPill, { backgroundColor: colors.primary }]}>
                        {busy === boost.id ? (
                          <LoadingIndicator size={16} />
                        ) : (
                          <Text style={styles.payPillText}>{t('boost.payNow')}</Text>
                        )}
                      </Pressable>
                    ) : (
                      <View style={[styles.statusPill, { backgroundColor: `${statusColor(boost.status)}1F` }]}>
                        <Text style={[styles.statusText, { color: statusColor(boost.status) }]}>
                          {t(`boost.status.${boost.status}`)}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        )}

        <View
          style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}
        >
          <Button label={t('boost.pay', { amount: price })} onPress={start} loading={busy === 'new'} disabled={!price || busy !== null} />
        </View>
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleGroup: { marginLeft: 14, flex: 1 },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, paddingBottom: 32, gap: 12 },
  hero: { borderRadius: 22, padding: 20, alignItems: 'center' },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', textAlign: 'center' },
  heroText: { ...typography.caption, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginTop: 4, lineHeight: 17 },
  section: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 4 },
  plans: { flexDirection: 'row', gap: 8 },
  plan: { flex: 1, borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  planDays: { ...typography.caption, fontFamily: fonts.medium },
  planPrice: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 2 },
  note: { ...typography.caption, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  rowTitle: { ...typography.body, fontFamily: fonts.semiBold },
  rowMeta: { ...typography.caption, marginTop: 1 },
  payPill: { borderRadius: 14, paddingHorizontal: 12, height: 30, justifyContent: 'center', minWidth: 70, alignItems: 'center' },
  payPillText: { ...typography.caption, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  statusPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { ...typography.caption, fontSize: 11, fontFamily: fonts.semiBold },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
