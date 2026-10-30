import React, { useRef, useState } from 'react';
import { Dimensions, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { LoadingIndicator } from './LoadingIndicator';
import { PullToRefresh } from './PullToRefresh';
import { ToastHost } from './ToastHost';
import { LiveMap, MapPoint } from './LiveMap';
import { useAnswerDelivery, useMyDeliveries, useVerifyDeliveryPin } from '@/hooks/useDeliveries';
import { useStaffLocationShare } from '@/hooks/useStaffLocationShare';
import { useDeliveriesStore } from '@/state/deliveriesStore';
import { StaffDelivery } from '@/services/deliveriesService';
import { formatRupees } from '@/services/shopOrdersService';
import { ApiError } from '@/services/apiClient';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { callPhone, openDirections } from '@/utils/tripLinks';
import { placeName } from '@/utils/formatAddress';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

const DONE_GRADIENT = ['#16A34A', '#22C55E'] as const;
const MAP_HEIGHT = Math.round(Dimensions.get('window').height * 0.4);

/**
 * Delivery staff's own screen (root-mounted, opened via `openDeliveries`): deliveries a shop
 * handed them. A new one waits for Accept / Decline; an accepted one opens full screen — a big
 * map (where to go, where you are), the steps (picked up, collect the cash, customer's PIN).
 * Nothing else of the shop (other orders, bills, earnings) is ever shown.
 */
export function StaffDeliveriesModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const visible = useDeliveriesStore((state) => state.visible);
  const focusId = useDeliveriesStore((state) => state.focusId);
  const close = useDeliveriesStore((state) => state.close);
  const deliveries = useMyDeliveries(visible);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = deliveries.data ?? [];
  const waiting = list.filter((entry) => entry.staffStatus === 'pending' && ['packed', 'out_for_delivery'].includes(entry.status));
  const onTheWay = list.filter((entry) => entry.staffStatus === 'accepted' && entry.status === 'out_for_delivery');
  const done = list.filter((entry) => entry.status === 'completed').slice(0, 10);
  // My position: on the map, and sent for each delivery on its way (the owner's map).
  const me = useStaffLocationShare(visible, onTheWay.map((entry) => entry.id));
  // A notification tap on an accepted delivery opens it straight away.
  const focused = focusId ? onTheWay.find((entry) => entry.id === focusId) : undefined;
  const shownId = openId ?? focused?.id ?? null;
  const shown = shownId ? onTheWay.find((entry) => entry.id === shownId) ?? null : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Pressable style={styles.backButton} onPress={close} accessibilityLabel={t('common.close')} hitSlop={8}>
            <FontAwesome6 name="chevron-left" size={16} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.headerTitle}>{t('deliveries.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('deliveries.subtitle')}</Text>
          </View>
        </LinearGradient>

        {deliveries.isLoading ? (
          <View style={styles.center}>
            <LoadingIndicator size={40} dotSize={6} color={colors.primary} />
          </View>
        ) : (
          <PullToRefresh refreshing={deliveries.isRefetching} onRefresh={() => deliveries.refetch()} style={styles.flex}>
            <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
              {deliveries.isError ? (
                <View style={styles.empty}>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('deliveries.loadFailed')}</Text>
                  <Button label={t('common.retry')} onPress={() => deliveries.refetch()} />
                </View>
              ) : null}
              {waiting.length > 0 ? <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('deliveries.newSection')}</Text> : null}
              {waiting.map((delivery) => (
                <RequestCard key={delivery.id} delivery={delivery} onAccepted={() => setOpenId(delivery.id)} />
              ))}
              {onTheWay.length > 0 ? <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('deliveries.onTheWaySection')}</Text> : null}
              {onTheWay.map((delivery) => (
                <Pressable
                  key={delivery.id}
                  onPress={() => setOpenId(delivery.id)}
                  style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: `${colors.primary}40`, opacity: pressed ? 0.9 : 1 }]}
                >
                  <Summary delivery={delivery} />
                  <View style={[styles.openRow, { backgroundColor: `${colors.primary}10` }]}>
                    <FontAwesome6 name="map-location-dot" size={13} color={colors.primary} solid />
                    <Text style={[styles.openText, { color: colors.primary }]}>{t('deliveries.openTrip')}</Text>
                    <FontAwesome6 name="chevron-right" size={11} color={colors.primary} solid />
                  </View>
                </Pressable>
              ))}
              {!deliveries.isError && waiting.length === 0 && onTheWay.length === 0 ? (
                <View style={styles.empty}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
                    <FontAwesome6 name="person-biking" size={26} color={colors.primary} solid />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('deliveries.emptyTitle')}</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('deliveries.emptyText')}</Text>
                </View>
              ) : null}
              {done.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('deliveries.doneSection')}</Text>
                  {done.map((delivery) => (
                    <View key={delivery.id} style={[styles.doneRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <FontAwesome6 name="circle-check" size={16} color={brandColors.success} solid />
                      <View style={styles.flex}>
                        <Text style={[styles.doneName, { color: colors.text }]} numberOfLines={1}>
                          {delivery.customerFullName}
                        </Text>
                        <Text style={[styles.doneMeta, { color: colors.textMuted }]} numberOfLines={1}>
                          {delivery.shopName}
                        </Text>
                      </View>
                      {delivery.totalAmount != null ? (
                        <Text style={[styles.doneAmount, { color: colors.text }]}>{formatRupees(delivery.totalAmount)}</Text>
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}
            </ScrollView>
          </PullToRefresh>
        )}
        <ToastHost />
      </View>
      <TripModal
        delivery={shown}
        me={me}
        onClose={() => {
          setOpenId(null);
          if (focusId) useDeliveriesStore.setState({ focusId: null });
        }}
      />
    </Modal>
  );
}

/** Who, what, where and the cash — shared by the request card and the trip list. */
function Summary({ delivery }: { delivery: StaffDelivery }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const place = placeName(delivery.locationAddress ?? '');
  return (
    <>
      <View style={styles.shopRow}>
        <FontAwesome6 name="store" size={11} color={colors.primary} solid />
        <Text style={[styles.shopName, { color: colors.primary }]} numberOfLines={1}>
          {delivery.shopName}
        </Text>
      </View>
      <Text style={[styles.customer, { color: colors.text }]} numberOfLines={1}>
        {delivery.customerFullName}
      </Text>
      <Text style={[styles.place, { color: colors.textMuted }]} numberOfLines={1}>
        {[place, t('deliveries.itemsCount', { count: delivery.items.length })].filter(Boolean).join(' · ')}
      </Text>
      {delivery.totalAmount != null ? (
        <Text style={[styles.cash, { color: brandColors.success }]}>{t('deliveries.cashLine', { amount: formatRupees(delivery.totalAmount) })}</Text>
      ) : null}
    </>
  );
}

function RequestCard({ delivery, onAccepted }: { delivery: StaffDelivery; onAccepted: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const answer = useAnswerDelivery();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const respond = (accept: boolean) => {
    setBusy(accept ? 'accept' : 'decline');
    answer.mutate(
      { id: delivery.id, accept },
      {
        onSuccess: () => {
          showToast({ variant: accept ? 'success' : 'info', title: t(accept ? 'deliveries.acceptedTitle' : 'deliveries.declinedTitle') });
          if (accept) onAccepted();
        },
        onError: (err) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) }),
        onSettled: () => setBusy(null),
      },
    );
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: `${brandColors.success}80`, borderWidth: 2 }]}>
      <Summary delivery={delivery} />
      <View style={styles.actions}>
        <Pressable
          disabled={busy !== null}
          onPress={() => respond(false)}
          style={[styles.decline, { borderColor: `${brandColors.error}59`, backgroundColor: `${brandColors.error}0D` }]}
        >
          {busy === 'decline' ? (
            <LoadingIndicator color={brandColors.error} size={20} dotSize={4} />
          ) : (
            <Text style={[styles.declineText, { color: brandColors.error }]}>{t('bookings.decline')}</Text>
          )}
        </Pressable>
        <Pressable disabled={busy !== null} onPress={() => respond(true)} style={styles.flex}>
          <LinearGradient colors={DONE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accept}>
            {busy === 'accept' ? (
              <LoadingIndicator color="#FFFFFF" size={20} dotSize={4} />
            ) : (
              <Text style={styles.acceptText}>{t('deliveries.accept')}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

/** One accepted delivery, full screen: the big map, then the steps down to the PIN. */
function TripModal({ delivery, me, onClose }: { delivery: StaffDelivery | null; me: MapPoint | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const verify = useVerifyDeliveryPin();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const pinRef = useRef<TextInput>(null);
  if (!delivery) return null;
  const place = placeName(delivery.locationAddress ?? '');

  const submit = () =>
    verify.mutate(
      { id: delivery.id, pin },
      {
        onSuccess: () => {
          Keyboard.dismiss();
          setPin('');
          showToast({ variant: 'success', title: t('deliveries.doneTitle'), message: t('deliveries.doneMessage') });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'ORDER_PIN_INVALID') {
            const left = (error.details as { attemptsLeft?: number } | undefined)?.attemptsLeft ?? 0;
            setPinError(t('shopOrders.pinWrong', { count: left }));
            setPin('');
            return;
          }
          showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
        },
      },
    );

  const step = (icon: React.ComponentProps<typeof FontAwesome6>['name'], title: string, text: string, state: 'done' | 'now') => (
    <View style={styles.step}>
      <View style={[styles.stepDot, { backgroundColor: state === 'done' ? brandColors.success : colors.primary }]}>
        <FontAwesome6 name={state === 'done' ? 'check' : icon} size={12} color="#FFFFFF" solid />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.stepText, { color: colors.textMuted }]}>{text}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View>
          <LiveMap customer={{ latitude: delivery.latitude, longitude: delivery.longitude }} worker={me} height={MAP_HEIGHT + insets.top} />
          <Pressable
            onPress={onClose}
            accessibilityLabel={t('common.back')}
            style={[styles.mapBack, { top: insets.top + 10, backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <FontAwesome6 name="chevron-left" size={15} color={colors.text} solid />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.panel, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('deliveries.deliverTo')}</Text>
            <View style={styles.personRow}>
              <View style={styles.flex}>
                <Text style={[styles.customer, { color: colors.text }]} numberOfLines={1}>
                  {delivery.customerFullName}
                </Text>
                {place ? (
                  <Text style={[styles.place, { color: colors.textMuted }]} numberOfLines={1}>
                    {place}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => callPhone(delivery.customerMobileNumber)} style={[styles.round, { backgroundColor: brandColors.success }]}>
                <FontAwesome6 name="phone" size={14} color="#FFFFFF" solid />
              </Pressable>
              <Pressable
                onPress={() => openDirections({ latitude: delivery.latitude, longitude: delivery.longitude })}
                style={[styles.round, { backgroundColor: colors.primary }]}
              >
                <FontAwesome6 name="diamond-turn-right" size={14} color="#FFFFFF" solid />
              </Pressable>
            </View>
            {delivery.note ? <Text style={[styles.note, { color: colors.textMuted }]}>“{delivery.note}”</Text> : null}
          </View>

          {/* The steps: picking up is done, then the cash, then the PIN at the door. */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 12 }]}>
            {step('store', t('deliveries.stepPicked'), t('deliveries.stepPickedText', { shop: delivery.shopName }), 'done')}
            {delivery.totalAmount != null
              ? step('money-bill-wave', t('deliveries.stepCash', { amount: formatRupees(delivery.totalAmount) }), t('deliveries.stepCashText'), 'now')
              : null}
            {step('key', t('deliveries.stepPin'), t('deliveries.stepPinText'), 'now')}
          </View>

          <View style={[styles.card, styles.pinCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <Text style={[styles.pinTitle, { color: colors.text }]}>{t('shopOrders.pinTitle')}</Text>
            <Text style={[styles.place, styles.centerText, { color: colors.textMuted }]}>{t('shopOrders.pinHintDelivery')}</Text>
            <Pressable style={styles.pinBoxes} onPress={() => pinRef.current?.focus()}>
              {[0, 1, 2, 3].map((index) => {
                const digit = pin[index];
                const borderColor = pinError ? brandColors.error : digit || index === pin.length ? colors.primary : colors.border;
                return (
                  <View key={index} style={[styles.pinBox, { borderColor, backgroundColor: digit ? `${colors.primary}0D` : colors.background }]}>
                    <Text style={[styles.pinDigit, { color: colors.text }]}>{digit ?? ''}</Text>
                  </View>
                );
              })}
              <TextInput
                ref={pinRef}
                style={styles.pinHiddenInput}
                value={pin}
                onChangeText={(text) => {
                  setPinError(null);
                  setPin(text.replace(/[^0-9]/g, '').slice(0, 4));
                }}
                keyboardType="number-pad"
                maxLength={4}
                caretHidden
              />
            </Pressable>
            {pinError ? <Text style={[styles.pinError, { color: brandColors.error }]}>{pinError}</Text> : null}
            <View style={styles.fullWidth}>
              <Button label={t('shopOrders.verifyPin')} onPress={submit} loading={verify.isPending} disabled={pin.length !== 4} gradient={DONE_GRADIENT} />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 4 }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('deliveries.handOver', { count: delivery.items.length })}</Text>
            {delivery.items.map((item, index) => (
              <Text key={`${item.name}-${index}`} style={[styles.item, { color: colors.text }]} numberOfLines={1}>
                {index + 1}. {item.name}
                {item.quantity ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}
              </Text>
            ))}
          </View>
        </ScrollView>
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  fullWidth: { alignSelf: 'stretch', marginTop: 6 },
  centerText: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16 },
  sectionLabel: { ...typography.caption, fontFamily: fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyText: { ...typography.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12, gap: 4 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shopName: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, letterSpacing: 0.3, textTransform: 'uppercase', flexShrink: 1 },
  customer: { ...typography.subheading, fontFamily: fonts.semiBold, fontSize: 17 },
  place: { ...typography.caption, fontSize: 12.5 },
  cash: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, height: 40, marginTop: 6 },
  openText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5, flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  decline: { height: 46, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  declineText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  accept: { height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 15 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  doneName: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  doneMeta: { ...typography.caption, fontSize: 11.5 },
  doneAmount: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  // Trip
  mapBack: { position: 'absolute', left: 14, width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  panel: { padding: 16 },
  cardLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  note: { ...typography.caption, fontSize: 12.5, marginTop: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14.5 },
  stepText: { ...typography.caption, fontSize: 12, lineHeight: 16 },
  item: { ...typography.body, fontSize: 14 },
  pinCard: { alignItems: 'center', borderWidth: 1.5, gap: 6 },
  pinTitle: { ...typography.subheading, fontFamily: fonts.semiBold },
  pinBoxes: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 10, marginBottom: 4 },
  pinBox: { width: 54, height: 62, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pinDigit: { fontSize: 26, lineHeight: 34, fontFamily: fonts.semiBold, textAlign: 'center', includeFontPadding: false },
  pinHiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
  pinError: { ...typography.caption, fontFamily: fonts.medium, textAlign: 'center' },
});
