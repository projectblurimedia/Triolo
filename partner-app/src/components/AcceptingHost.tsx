import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { LoadingIndicator } from './LoadingIndicator';
import { useAcceptBookingOffer } from '@/hooks/useBookingOffers';
import { useShopOrderAction } from '@/hooks/useShopOrders';
import { shopOrdersService } from '@/services/shopOrdersService';
import { ApiError } from '@/services/apiClient';
import { useAcceptingStore } from '@/state/acceptingStore';
import { useAuthStore } from '@/state/authStore';
import { useIncomingStore } from '@/state/incomingStore';
import { usePayGateStore } from '@/state/payGateStore';
import { openJob } from '@/state/jobFocusStore';
import { openShopOrder } from '@/state/shopOrderFocusStore';
import { showToast } from '@/state/toastStore';
import { openSubscribe } from '@/state/subscribeStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { GivenBackError } from '@/utils/afterAccept';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

/**
 * Root-mounted (inside the QueryClientProvider). Two jobs:
 *  - Accept on the floating pop-up: accepts that job / order straight away and opens its screen —
 *    no Live Requests list in between (it used to open the list, which showed "0 requests" while
 *    loading and again once the accepted request left it).
 *  - While any accept runs, covers the screen with "Accepting…" (hidden while the pay sheet is up).
 */
export function AcceptingHost() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const accessToken = useAuthStore((state) => state.accessToken);
  const popupKey = useAcceptingStore((state) => state.popupKey);
  const accepting = useAcceptingStore((state) => state.accepting);
  const paying = usePayGateStore((state) => state.request !== null);
  const acceptJob = useAcceptBookingOffer();
  const acceptOrder = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.accept(id), 'accept');

  useEffect(() => {
    if (!popupKey || !accessToken) return;
    useAcceptingStore.getState().clearPopup();
    const type = popupKey.startsWith('order-') ? 'order' : popupKey.startsWith('job-') ? 'job' : null;
    if (!type) return;
    const id = popupKey.slice(type.length + 1);
    void (async () => {
      useAcceptingStore.getState().setAccepting(type);
      try {
        if (type === 'job') {
          await acceptJob.mutateAsync(id);
          Notifications.dismissNotificationAsync(id).catch(() => {});
          showToast({ variant: 'success', title: t('bookings.acceptedToastTitle'), message: t('bookings.acceptedToastMessage') });
          openJob(id);
        } else {
          await acceptOrder.mutateAsync({ id });
          showToast({ variant: 'success', title: t('shopOrders.acceptedTitle') });
          openShopOrder(id);
        }
      } catch (error) {
        if (error instanceof GivenBackError) return;
        // Free accepts used up: subscribe first, then accept from Live Requests.
        if (error instanceof ApiError && error.code === 'ACCEPT_LIMIT_REACHED') {
          showToast({ variant: 'info', title: t('quickLimit.reachedTitle'), message: t('errors.ACCEPT_LIMIT_REACHED') });
          openSubscribe(type === 'order' ? 'shop' : 'service');
          useIncomingStore.getState().openList(true);
          return;
        }
        const taken =
          error instanceof ApiError && ['BOOKING_ALREADY_TAKEN', 'ORDER_INVALID_STATE', 'ORDER_ALREADY_TAKEN'].includes(error.code ?? '');
        showToast({
          variant: taken ? 'info' : 'error',
          title: t(taken ? 'bookings.takenToastTitle' : 'common.errorTitle'),
          message: taken ? t('bookings.takenToastMessage') : getLocalizedErrorMessage(error, t),
        });
        // Not taken: the requests still waiting are on Live Requests.
        if (!taken) useIncomingStore.getState().openList(true);
      } finally {
        useAcceptingStore.getState().setAccepting(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupKey, accessToken]);

  return (
    <Modal visible={!!accepting && !paying} transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      {/* A small card over the dimmed screen — not a full white page. */}
      <View style={styles.cover}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
            <FontAwesome6 name={accepting === 'order' ? 'basket-shopping' : 'screwdriver-wrench'} size={22} color="#FFFFFF" solid />
          </LinearGradient>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: colors.text }]}>{t(accepting === 'order' ? 'accepting.order' : 'accepting.job')}</Text>
            <Text style={[styles.text, { color: colors.textMuted }]}>{t('accepting.wait')}</Text>
          </View>
          <LoadingIndicator size={28} color={headerGradient[0]} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    alignSelf: 'stretch',
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  flex: { flex: 1 },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  text: { ...typography.caption, fontSize: 12.5 },
});
