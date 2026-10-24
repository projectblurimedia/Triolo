import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { GlassBackdrop, GlassCard } from './Glass';
import { LoadingIndicator } from './LoadingIndicator';
import { GOLD_BUTTON, GOLD_DEEP, GOLD_GRADIENT } from './GoldCard';
import { subscriptionsService } from '@/services/subscriptionsService';
import { usePayGateStore } from '@/state/payGateStore';
import { openSubscribe } from '@/state/subscribeStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { fonts, typography, useThemeColors } from '@/theme';

type Step = 'offer' | 'starting' | 'waiting' | 'checking';

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome6>['name']> = {
  book: 'screwdriver-wrench',
  order: 'basket-shopping',
  staff_contact: 'phone',
  accept: 'handshake',
  job_post: 'briefcase',
};

/**
 * (Copied in partner-app — keep in sync.)
 * The pay-once sheet (root-mounted; opened by payIfNeeded): "Pay ₹X" opens Razorpay in the
 * browser; coming back checks the payment and, once it's through, the action that asked
 * carries on by itself. "Subscribe instead" opens the plans.
 */
export function PayGateSheet() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const request = usePayGateStore((state) => state.request);
  const finish = usePayGateStore((state) => state.finish);
  const [step, setStep] = useState<Step>('offer');
  const passId = useRef<string | null>(null);

  useEffect(() => {
    if (request) {
      setStep('offer');
      passId.current = null;
    }
  }, [request]);

  const done = (paid: boolean) => {
    if (paid) queryClient.invalidateQueries({ queryKey: ['subscription'] });
    finish(paid);
  };

  const check = async (quiet: boolean) => {
    if (!passId.current) return;
    setStep('checking');
    try {
      const result = await subscriptionsService.passCheck(passId.current);
      if (result.paid) {
        // Read the request now: this also runs from the app-state listener set up on first render.
        const kind = usePayGateStore.getState().request?.kind;
        showToast({ variant: 'success', title: t('payGate.paidTitle'), message: kind ? t(`payGate.paidMessage.${kind}`) : undefined });
        done(true);
        return;
      }
      if (!quiet) showToast({ variant: 'info', title: t('subscribe.notPaidTitle'), message: t('subscribe.notPaidMessage') });
    } catch (error) {
      if (!quiet) showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    }
    setStep('waiting');
  };

  // Back from the payment page: check straight away.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active' && passId.current && usePayGateStore.getState().request) check(true);
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = async () => {
    if (!request) return;
    setStep('starting');
    try {
      const result = await subscriptionsService.passCheckout(request.kind, request.targetId);
      if (result.paid) {
        done(true);
        return;
      }
      passId.current = result.id;
      setStep('waiting');
      if (result.paymentUrl) await Linking.openURL(result.paymentUrl);
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
      setStep('offer');
    }
  };

  if (!request) return null;
  const kind = request.kind;
  const busy = step === 'starting' || step === 'checking';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => done(false)} statusBarTranslucent>
      <GlassBackdrop onPress={busy ? undefined : () => done(false)} style={styles.center}>
        <GlassCard style={styles.card}>
          <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
            <FontAwesome6 name={ICONS[kind] ?? 'indian-rupee-sign'} size={24} color="#FFFFFF" solid />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.text }]}>{t(`payGate.title.${kind}`)}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>
            {step === 'waiting' || step === 'checking'
              ? t('payGate.waiting')
              : t(`payGate.message.${kind}`, { amount: request.amount })}
          </Text>

          {step === 'waiting' || step === 'checking' ? (
            <Pressable
              onPress={() => check(false)}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.outline, { borderColor: GOLD_DEEP }]}
            >
              {step === 'checking' ? (
                <LoadingIndicator size={20} color={GOLD_DEEP} />
              ) : (
                <Text style={[styles.outlineText, { color: GOLD_DEEP }]}>{t('subscribe.checkPaid')}</Text>
              )}
            </Pressable>
          ) : (
            <Pressable onPress={pay} disabled={busy} accessibilityRole="button" style={styles.payWrap}>
              <LinearGradient colors={GOLD_BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pay}>
                {step === 'starting' ? (
                  <LoadingIndicator size={20} />
                ) : (
                  <>
                    <FontAwesome6 name="lock-open" size={14} color="#FFFFFF" solid />
                    <Text style={styles.payText}>{t('payGate.pay', { amount: request.amount })}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              done(false);
              openSubscribe();
            }}
            disabled={busy}
            hitSlop={6}
            style={styles.linkRow}
          >
            <FontAwesome6 name="crown" size={12} color={GOLD_DEEP} solid />
            <Text style={[styles.link, { color: GOLD_DEEP }]}>{t('payGate.subscribeInstead')}</Text>
          </Pressable>
          <Pressable onPress={() => done(false)} disabled={busy} hitSlop={6}>
            <Text style={[styles.cancel, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
          </Pressable>
        </GlassCard>
      </GlassBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  card: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, alignItems: 'center', gap: 4 },
  icon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  message: { ...typography.body, textAlign: 'center', lineHeight: 21, marginTop: 4, marginBottom: 16 },
  // Solid gold under the gradient: the button can never come out see-through.
  payWrap: { alignSelf: 'stretch', height: 50, borderRadius: 14, overflow: 'hidden', backgroundColor: GOLD_BUTTON[1] },
  pay: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  payText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  outline: { alignSelf: 'stretch', height: 50, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  outlineText: { ...typography.body, fontFamily: fonts.semiBold },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  link: { ...typography.body, fontFamily: fonts.semiBold },
  cancel: { ...typography.caption, marginTop: 12 },
});
