import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './Button';
import { GoldCard, GOLD_BORDER, GOLD_BUTTON, GOLD_DEEP, GOLD_HEADER, GOLD_INK, GOLD_INK_SOFT } from './GoldCard';
import { LoadingIndicator } from './LoadingIndicator';
import { ToastHost } from './ToastHost';
import { SUBSCRIPTION_QUERY_KEY, useMySubscription } from '@/hooks/useSubscription';
import { SUBSCRIPTION_MONTHS, subscriptionsService } from '@/services/subscriptionsService';
import { useSubscribeStore } from '@/state/subscribeStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDay } from '@/utils/formatDate';
import { fonts, typography, useThemeColors } from '@/theme';

const PERKS = [
  { icon: 'bolt', key: 'perkQuickBook' },
  { icon: 'user-check', key: 'perkBookWorker' },
  { icon: 'basket-shopping', key: 'perkOrder' },
  { icon: 'ban', key: 'perkNoAds' },
] as const;

/**
 * The customer's subscription screen (root-mounted; opened by openSubscribe()). Plans at the
 * admin's prices, paid on a Razorpay page in the browser. Coming back to the app checks the
 * payment, so the plan starts without any extra tap; "I've paid" checks again by hand.
 */
export function SubscribeModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const visible = useSubscribeStore((state) => state.visible);
  const close = useSubscribeStore((state) => state.close);
  const { data, isLoading, refetch } = useMySubscription();
  const [months, setMonths] = useState<number>(3);
  const [busy, setBusy] = useState<'pay' | 'check' | null>(null);
  // The payment opened in the browser that we check when the app comes back.
  const waitingId = useRef<string | null>(null);

  useEffect(() => {
    if (visible) refetch();
  }, [visible, refetch]);

  const check = async (id: string, quiet: boolean) => {
    if (!quiet) setBusy('check');
    try {
      const result = await subscriptionsService.check(id);
      queryClient.setQueryData(SUBSCRIPTION_QUERY_KEY, result);
      if (result.paid || result.active) {
        waitingId.current = null;
        showToast({ variant: 'success', title: t('subscribe.paidTitle'), message: t('subscribe.paidMessage') });
      } else if (!quiet) {
        showToast({ variant: 'info', title: t('subscribe.notPaidTitle'), message: t('subscribe.notPaidMessage') });
      }
    } catch (error) {
      if (!quiet) showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      if (!quiet) setBusy(null);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active' && waitingId.current) check(waitingId.current, true);
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = async () => {
    setBusy('pay');
    try {
      const result = await subscriptionsService.checkout(months);
      waitingId.current = result.id;
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      await Linking.openURL(result.paymentUrl);
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      setBusy(null);
    }
  };

  const reopenPending = async () => {
    if (!data?.pending) return;
    waitingId.current = data.pending.id;
    await Linking.openURL(data.pending.paymentUrl).catch(() => {});
  };

  const prices = data?.prices;
  const price = prices ? prices[String(months) as '1' | '3' | '6' | '12'] : 0;
  const pending = data?.pending ?? null;
  const active = data?.active ?? null;

  const renderBody = () => {
    if (isLoading || !data) {
      return (
        <View style={styles.center}>
          <LoadingIndicator size={44} color={GOLD_DEEP} />
        </View>
      );
    }
    if (!data.enabled) {
      return (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('subscribe.off')}</Text>
        </View>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <GoldCard style={styles.hero}>
          <View style={styles.crown}>
            <FontAwesome6 name="crown" size={24} color="#8A5300" solid />
          </View>
          <Text style={styles.heroTitle}>{active ? t('subscribe.activeTitle') : t('subscribe.heroTitle')}</Text>
          <Text style={styles.heroText}>
            {active ? t('subscribe.activeUntil', { date: formatDay(active.endsAt) }) : t('subscribe.heroText')}
          </Text>
        </GoldCard>

        <View style={[styles.perks, { backgroundColor: colors.surface, borderColor: `${GOLD_BORDER}80` }]}>
          {PERKS.map((perk) => (
            <View key={perk.key} style={styles.perkRow}>
              <View style={[styles.perkIcon, { backgroundColor: `${GOLD_DEEP}22` }]}>
                <FontAwesome6 name={perk.icon} size={14} color={GOLD_DEEP} solid />
              </View>
              <Text style={[styles.perkText, { color: colors.text }]}>{t(`subscribe.${perk.key}`)}</Text>
              <FontAwesome6 name="circle-check" size={16} color={GOLD_DEEP} solid />
            </View>
          ))}
        </View>

        {/* While a plan runs there's nothing to buy; the plans come back once it ends. */}
        {active ? null : (
          <>
        <Text style={[styles.section, { color: colors.text }]}>{t('subscribe.choosePlan')}</Text>
        <View style={styles.plans}>
          {SUBSCRIPTION_MONTHS.map((m) => {
            const amount = prices?.[String(m) as '1' | '3' | '6' | '12'] ?? 0;
            const selected = months === m;
            const perMonth = Math.round(amount / m);
            return (
              <Pressable
                key={m}
                onPress={() => setMonths(m)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.plan,
                  { backgroundColor: colors.surface, borderColor: selected ? GOLD_DEEP : `${GOLD_BORDER}66`, borderWidth: selected ? 2 : 1.5 },
                ]}
              >
                {m === 12 ? (
                  <View style={[styles.bestTag, { backgroundColor: GOLD_INK }]}>
                    <Text style={styles.bestText}>{t('subscribe.best')}</Text>
                  </View>
                ) : null}
                <Text style={[styles.planMonths, { color: colors.textMuted }]}>{t('subscribe.months', { count: m })}</Text>
                <Text style={[styles.planPrice, { color: colors.text }]}>₹{amount}</Text>
                <Text style={[styles.planPer, { color: GOLD_DEEP }]}>{t('subscribe.perMonth', { amount: perMonth })}</Text>
              </Pressable>
            );
          })}
        </View>

        {pending ? (
          <View style={[styles.pending, { borderColor: GOLD_DEEP, backgroundColor: `${GOLD_DEEP}14` }]}>
            <FontAwesome6 name="clock" size={14} color={GOLD_DEEP} solid />
            <Text style={[styles.pendingText, { color: colors.text }]}>
              {t('subscribe.pending', { amount: pending.amount, count: pending.months })}
            </Text>
            <Pressable onPress={reopenPending} hitSlop={8}>
              <Text style={[styles.pendingLink, { color: GOLD_DEEP }]}>{t('subscribe.openPayment')}</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={[styles.note, { color: colors.textMuted }]}>{t('subscribe.note')}</Text>
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={GOLD_HEADER}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={close} accessibilityLabel={t('common.back')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t('subscribe.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('subscribe.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {renderBody()}

        {data?.enabled && !active ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: insets.bottom + 16, borderTopColor: `${GOLD_BORDER}66`, backgroundColor: colors.background },
            ]}
          >
            {pending ? (
              <Pressable
                onPress={() => check(pending.id, false)}
                disabled={busy !== null}
                style={[styles.checkButton, { borderColor: GOLD_DEEP }]}
                accessibilityRole="button"
              >
                {busy === 'check' ? (
                  <LoadingIndicator size={22} color={GOLD_DEEP} />
                ) : (
                  <Text style={[styles.checkText, { color: GOLD_DEEP }]}>{t('subscribe.checkPaid')}</Text>
                )}
              </Pressable>
            ) : null}
            <Button
              label={t('subscribe.pay', { amount: price })}
              onPress={pay}
              loading={busy === 'pay'}
              disabled={!price || busy !== null}
              gradient={GOLD_BUTTON}
            />
          </View>
        ) : null}
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { ...typography.body, textAlign: 'center' },
  body: { padding: 20, paddingBottom: 32, gap: 14 },
  hero: { padding: 20, alignItems: 'center' },
  crown: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: GOLD_INK, textAlign: 'center' },
  heroText: { ...typography.caption, color: GOLD_INK_SOFT, textAlign: 'center', marginTop: 4, lineHeight: 17 },
  perks: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  perkText: { ...typography.body, flex: 1 },
  section: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 4 },
  plans: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  plan: { width: '48%', flexGrow: 1, borderWidth: 1.5, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  bestTag: { position: 'absolute', top: -9, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  bestText: { ...typography.caption, fontSize: 10, color: '#FFFFFF', fontFamily: fonts.semiBold },
  planMonths: { ...typography.caption, fontFamily: fonts.medium },
  planPrice: { ...typography.heading, fontFamily: fonts.semiBold, marginTop: 2 },
  planPer: { ...typography.caption, fontFamily: fonts.medium },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  pendingText: { ...typography.caption, flex: 1, lineHeight: 17 },
  pendingLink: { ...typography.caption, fontFamily: fonts.semiBold },
  note: { ...typography.caption, textAlign: 'center', lineHeight: 17 },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, gap: 10 },
  checkButton: { height: 48, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkText: { ...typography.body, fontFamily: fonts.semiBold },
});
