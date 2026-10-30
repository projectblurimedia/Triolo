import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { GlassBackdrop, GlassCard } from './Glass';
import { LoadingIndicator } from './LoadingIndicator';
import { LiveMap } from './LiveMap';
import { useShopOrderAction } from '@/hooks/useShopOrders';
import { useShopStaff } from '@/hooks/useBusinessMutations';
import { formatRupees, ShopOrder, shopOrdersService } from '@/services/shopOrdersService';
import { showToast } from '@/state/toastStore';
import { callPhone } from '@/utils/tripLinks';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

const DONE_GRADIENT = ['#16A34A', '#22C55E'] as const;

/**
 * Who takes a delivery order to the customer: the owner ("I'll deliver" — the usual out for
 * delivery step) or one of the shop's delivery staff, who then sees just this order's items,
 * the place, and the PIN step, and collects the cash. Shown for a packed delivery order, and
 * while it is out for delivery (to see or change who has it).
 */
export function DeliveryHandover({
  order,
  onDeliverMyself,
  deliverMyselfLoading,
  onError,
}: {
  order: ShopOrder;
  onDeliverMyself: () => void;
  deliverMyselfLoading: boolean;
  onError: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [picking, setPicking] = useState(false);
  const staff = useShopStaff(order.shopId ?? undefined);
  const assign = useShopOrderAction(({ id, staffAccountId }: { id: string; staffAccountId: string | null }) =>
    shopOrdersService.assignDelivery(id, staffAccountId),
  );

  const choose = (staffAccountId: string | null, name?: string) =>
    assign.mutate(
      { id: order.id, staffAccountId },
      {
        onSuccess: () => {
          setPicking(false);
          showToast({
            variant: 'success',
            title: staffAccountId ? t('deliveryStaff.sentTitle', { name }) : t('deliveryStaff.selfTitle'),
            // They accept it in their app first.
            message: staffAccountId ? t('deliveryStaff.sentMessage') : undefined,
          });
        },
        onError,
      },
    );

  const picker = (
    <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)} statusBarTranslucent>
      <GlassBackdrop onPress={() => setPicking(false)} style={styles.overlay}>
        <GlassCard style={styles.sheet}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{t('deliveryStaff.pickTitle')}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('deliveryStaff.pickHint')}</Text>
            </View>
            <Pressable onPress={() => setPicking(false)} hitSlop={8} style={[styles.close, { borderColor: colors.border }]}>
              <FontAwesome6 name="xmark" size={14} color={colors.text} solid />
            </Pressable>
          </View>
          {staff.isLoading ? (
            <View style={styles.center}>
              <LoadingIndicator size={32} dotSize={5} color={colors.primary} />
            </View>
          ) : (staff.data ?? []).length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('deliveryStaff.noStaff')}</Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {(staff.data ?? []).filter((member) => member.status !== 'declined').map((member) => {
                const current = order.deliveryStaff?.accountId === member.accountId;
                // Invited people haven't joined yet: shown, but can't be given a delivery.
                const waiting = member.status === 'invited';
                return (
                  <Pressable
                    key={member.id}
                    disabled={assign.isPending || current || waiting}
                    onPress={() => choose(member.accountId, member.fullName)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: current ? `${colors.primary}12` : colors.surface,
                        borderColor: current ? colors.primary : colors.border,
                        opacity: waiting ? 0.55 : pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.avatar, { backgroundColor: `${colors.primary}14` }]}>
                      <FontAwesome6 name="person-biking" size={13} color={colors.primary} solid />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                        {member.fullName}
                      </Text>
                      <Text style={[styles.phone, { color: colors.textMuted }]}>
                        {waiting ? t('deliveryStaff.waitingToJoin') : member.mobileNumber}
                      </Text>
                    </View>
                    {current ? <FontAwesome6 name="circle-check" size={16} color={colors.primary} solid /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {order.deliveryStaff ? (
            <Pressable
              disabled={assign.isPending}
              onPress={() => choose(null)}
              style={({ pressed }) => [styles.selfRow, { borderColor: `${colors.primary}40`, opacity: pressed ? 0.85 : 1 }]}
            >
              <FontAwesome6 name="store" size={13} color={colors.primary} solid />
              <Text style={[styles.selfText, { color: colors.primary }]}>{t('deliveryStaff.deliverMyself')}</Text>
            </Pressable>
          ) : null}
          {assign.isPending ? (
            <View style={styles.center}>
              <LoadingIndicator size={28} dotSize={5} color={colors.primary} />
            </View>
          ) : null}
        </GlassCard>
      </GlassBackdrop>
    </Modal>
  );

  if (order.status === 'packed' && order.deliveryStaff) {
    const person = order.deliveryStaff;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: `${brandColors.warning}80` }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('deliveryStaff.waitingTitle')}</Text>
        <View style={styles.personRow}>
          <View style={[styles.avatar, { backgroundColor: `${brandColors.warning}1F` }]}>
            <FontAwesome6 name="hourglass-half" size={13} color={brandColors.warning} solid />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {person.fullName}
            </Text>
            <Text style={[styles.phone, { color: colors.textMuted }]}>{t('deliveryStaff.waitingText')}</Text>
          </View>
          <Pressable onPress={() => setPicking(true)} hitSlop={6} style={[styles.changeButton, { borderColor: `${colors.primary}40` }]}>
            <Text style={[styles.changeText, { color: colors.primary }]}>{t('deliveryStaff.change')}</Text>
          </Pressable>
        </View>
        {/* Take it back from them first, then go out for delivery yourself. */}
        <Button
          label={t('deliveryStaff.deliverMyself')}
          onPress={() => assign.mutate({ id: order.id, staffAccountId: null }, { onSuccess: onDeliverMyself, onError })}
          loading={deliverMyselfLoading || assign.isPending}
          gradient={DONE_GRADIENT}
        />
        {picker}
      </View>
    );
  }

  if (order.status === 'packed') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('deliveryStaff.whoDelivers')}</Text>
        <Button label={t('deliveryStaff.deliverMyself')} onPress={onDeliverMyself} loading={deliverMyselfLoading} gradient={DONE_GRADIENT} />
        <Pressable
          onPress={() => setPicking(true)}
          style={({ pressed }) => [styles.staffButton, { borderColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <FontAwesome6 name="person-biking" size={14} color={colors.primary} solid />
          <Text style={[styles.staffButtonText, { color: colors.primary }]}>{t('deliveryStaff.sendWithStaff')}</Text>
        </Pressable>
        {picker}
      </View>
    );
  }

  // Out for delivery.
  const person = order.deliveryStaff;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: person ? colors.primary : colors.border }]}>
      <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('deliveryStaff.deliveringNow')}</Text>
      <View style={styles.personRow}>
        <View style={[styles.avatar, { backgroundColor: `${colors.primary}14` }]}>
          <FontAwesome6 name={person ? 'person-biking' : 'store'} size={13} color={colors.primary} solid />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {person ? person.fullName : t('deliveryStaff.you')}
          </Text>
          {person ? (
            <Text style={[styles.phone, { color: colors.textMuted }]}>
              {person.accepted === false ? t('deliveryStaff.waitingText') : t('deliveryStaff.collects', { amount: formatRupees(order.totalAmount ?? 0) })}
            </Text>
          ) : null}
        </View>
        {person ? (
          <Pressable onPress={() => callPhone(person.mobileNumber)} hitSlop={6} style={[styles.iconButton, { borderColor: `${colors.primary}40` }]}>
            <FontAwesome6 name="phone" size={12} color={colors.primary} solid />
          </Pressable>
        ) : null}
        <Pressable onPress={() => setPicking(true)} hitSlop={6} style={[styles.changeButton, { borderColor: `${colors.primary}40` }]}>
          <Text style={[styles.changeText, { color: colors.primary }]}>{t(person ? 'deliveryStaff.change' : 'deliveryStaff.sendWithStaff')}</Text>
        </Pressable>
      </View>
      {person ? (
        <>
          {/* The customer's place (blue) and where the staff member is now (green). */}
          <View style={styles.map}>
            <LiveMap
              customer={{ latitude: order.latitude, longitude: order.longitude }}
              worker={order.staffLocation ? { latitude: order.staffLocation.latitude, longitude: order.staffLocation.longitude } : null}
              height={200}
            />
          </View>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            {order.staffLocation
              ? t('deliveryStaff.seenAgo', { count: Math.max(0, Math.round((Date.now() - new Date(order.staffLocation.at).getTime()) / 60000)) })
              : t('deliveryStaff.noLocationYet')}
          </Text>
          <Text style={[styles.note, { color: brandColors.success }]}>{t('deliveryStaff.staffEntersPin')}</Text>
          {/* They're late, not answering, phone off…: the owner takes it back and delivers it. */}
          <Pressable
            disabled={assign.isPending}
            onPress={() => choose(null)}
            style={({ pressed }) => [styles.selfRow, { borderColor: `${colors.primary}55`, opacity: pressed ? 0.85 : 1 }]}
          >
            {assign.isPending ? (
              <LoadingIndicator size={20} dotSize={4} color={colors.primary} />
            ) : (
              <>
                <FontAwesome6 name="store" size={13} color={colors.primary} solid />
                <Text style={[styles.selfText, { color: colors.primary }]}>{t('deliveryStaff.deliverInstead')}</Text>
              </>
            )}
          </Pressable>
        </>
      ) : null}
      {picker}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14, gap: 10 },
  cardLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' },
  staffButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, borderWidth: 1.5 },
  staffButtonText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14.5 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14.5 },
  phone: { ...typography.caption, fontSize: 11.5 },
  iconButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  changeButton: { height: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  changeText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  note: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12 },
  map: { borderRadius: 16, overflow: 'hidden' },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { borderRadius: 22, padding: 14, maxHeight: '80%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  subtitle: { ...typography.caption, fontSize: 12 },
  close: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 8 },
  selfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 14, borderWidth: 1.5, marginTop: 4 },
  selfText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  empty: { ...typography.body, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingVertical: 16 },
  center: { alignItems: 'center', paddingVertical: 12 },
});
