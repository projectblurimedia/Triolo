import { useMyShops } from '@/hooks/useBusinessMutations';
import React, { useEffect, useRef, useState } from 'react';
import { placeName } from '@/utils/formatAddress';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CancelButton } from './CancelButton';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { askForLocation } from '@/utils/ensureLocationOn';
import { useBusyAction } from './Ads';
import { PullToRefresh } from './PullToRefresh';
import { ListPhotoStrip } from './ListPhotoStrip';
import { DetailSkeleton } from './DetailSkeleton';
import { StepTimeline, TimelineStep } from './StepTimeline';
import { GivenBackError } from '@/utils/afterAccept';

// PullToRefresh's hidden room above the content (see that component).
const PULL_ROOM = 96;
import { DeliveryHandover } from './DeliveryHandover';
import { ToastHost } from './ToastHost';
import { useShopOrder, useShopOrderAction } from '@/hooks/useShopOrders';
import { useShopOrderFocusStore } from '@/state/shopOrderFocusStore';
import {
  ACTIVE_SHOP_STATUSES,
  formatRupees,
  ItemUpdate,
  PACKING_STATUSES,
  ShopOrder,
  ShopOrderItem,
  ShopOrderItemStatus,
  shopOrdersService,
  ShopOrderStatus,
} from '@/services/shopOrdersService';
import { ApiError } from '@/services/apiClient';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { callPhone, openDirections } from '@/utils/tripLinks';
import { formatDistance } from '@/utils/formatDistance';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];
// `name`: an item the shop types in itself (read from the list's photos). New ones have keys
// starting with NEW_ITEM until they are saved.
type Draft = Record<string, { status: ShopOrderItemStatus; price: string; name?: string }>;
const NEW_ITEM = 'new:';

const STATUS_ICONS: Record<ShopOrderStatus, IconName> = {
  placed: 'bell',
  accepted: 'store',
  preparing: 'basket-shopping',
  packed: 'receipt',
  ready_for_pickup: 'bag-shopping',
  out_for_delivery: 'truck-fast',
  completed: 'circle-check',
  cancelled: 'ban',
  declined: 'circle-xmark',
  expired: 'hourglass-end',
};
const DONE_GRADIENT = ['#16A34A', '#22C55E'] as const;
const DANGER_GRADIENT = ['#ef4444', '#dc2626'] as const;
const STAR_COLOR = '#FBBF24';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0][0] : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

function draftFrom(order: ShopOrder): Draft {
  const draft: Draft = {};
  for (const item of order.items) {
    draft[item.id] = { status: item.status, price: item.price != null ? String(item.price) : '', name: item.addedByShop ? item.name : undefined };
  }
  return draft;
}

function parsePrice(text: string): number | null {
  const value = Number(text.replace(/[^0-9.]/g, ''));
  return text.trim() === '' || Number.isNaN(value) ? null : value;
}

/**
 * A shop order as the shop works it (root-mounted, opened via `openShopOrder`): accept or
 * decline a new list; tick every item packed (with its price) or not available while a running
 * total updates; send the bill; mark it ready for pickup / out for delivery; then enter the
 * customer's 4-digit PIN at handover. The shop can cancel at any step before completion.
 */
export function ShopOrderModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const orderId = useShopOrderFocusStore((state) => state.orderId);
  // Several shops: say which shop this order is for.
  const manyShops = (useMyShops(orderId !== null).data ?? []).length > 1;
  const close = useShopOrderFocusStore((state) => state.close);
  const { data: order, isLoading, isError, refetch } = useShopOrder(orderId);
  // Handover: location, then a local business's ad while the button spins, then the PIN check.
  const { busy: pinBusy, run: runPin } = useBusyAction();

  const accept = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.accept(id), 'accept');
  const decline = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.decline(id));
  const saveItems = useShopOrderAction(({ id, items }: { id: string; items: ItemUpdate[] }) =>
    shopOrdersService.saveItems(id, items),
  );
  const packed = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.packed(id));
  const ready = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.ready(id));
  const verifyPin = useShopOrderAction(({ id, pin }: { id: string; pin: string }) => shopOrdersService.verifyPin(id, pin));
  const cancel = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.cancel(id));

  const [draft, setDraft] = useState<Draft>({});
  const [dirty, setDirty] = useState(false);
  // Items the shop typed in that aren't saved yet, and saved ones it took off again.
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [focusNameId, setFocusNameId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const pinInputRef = useRef<TextInput>(null);
  // Ticking an item as packed jumps straight to its price box, scrolled above the keyboard.
  const scrollRef = useRef<ScrollView>(null);
  const itemYs = useRef<Record<string, number>>({});
  const [focusPriceId, setFocusPriceId] = useState<string | null>(null);
  const scrollToItem = (id: string) => {
    const y = itemYs.current[id];
    if (y === undefined) return;
    // After the keyboard has opened and the screen has shrunk above it.
    // + PULL_ROOM: the content sits under PullToRefresh's hidden room.
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(PULL_ROOM, y - 90 + PULL_ROOM), animated: true }), 250);
  };
  const [confirm, setConfirm] = useState<'decline' | 'cancel' | null>(null);
  const [pulling, setPulling] = useState(false);
  const pullRefresh = async () => {
    setPulling(true);
    await refetch();
    setPulling(false);
  };
  const [confirmBill, setConfirmBill] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // The checklist starts from what's saved; the shop's unsaved ticks/prices aren't overwritten by polling.
  useEffect(() => {
    if (order && !dirty) {
      setDraft(draftFrom(order));
      setAdded([]);
      setRemoved([]);
    }
  }, [order, dirty]);

  useEffect(() => {
    setDirty(false);
    setPin('');
    setPinError(null);
  }, [orderId]);

  // This modal draws edge-to-edge, so Android doesn't resize it for the keyboard on its own.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const onError = (error: unknown) => {
    // Backed out of paying after accepting: it was given back (a toast said so).
    if (error instanceof GivenBackError) return;
    if (error instanceof ApiError && error.code === 'ORDER_INVALID_STATE') {
      refetch();
      showToast({ variant: 'info', title: t('shopOrders.changedTitle'), message: t('shopOrders.changedMessage') });
      return;
    }
    showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
  };

  const setItem = (id: string, patch: Partial<Draft[string]>) => {
    setDirty(true);
    setDraft((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  // The checklist: the customer's items, then the ones the shop typed in (saved and new).
  const checklistItems = (o: ShopOrder): ShopOrderItem[] => [
    ...o.items.filter((item) => !removed.includes(item.id)),
    ...added.map((key, index) => ({
      id: key,
      position: o.items.length + index + 1,
      name: draft[key]?.name ?? '',
      quantity: '',
      unit: null,
      status: draft[key]?.status ?? 'packed',
      price: null,
      addedByShop: true,
    })),
  ];

  const addItem = () => {
    const key = `${NEW_ITEM}${Date.now()}`;
    setDirty(true);
    setAdded((current) => [...current, key]);
    setDraft((current) => ({ ...current, [key]: { status: 'packed', price: '', name: '' } }));
    setFocusNameId(key);
  };

  const removeItem = (id: string) => {
    setDirty(true);
    if (id.startsWith(NEW_ITEM)) setAdded((current) => current.filter((key) => key !== id));
    else setRemoved((current) => [...current, id]);
  };

  // Ticked = packed (with its price). Unticked items become "not available" only when the
  // bill is sent (`final`); a quiet save on close keeps them undecided. A typed-in item with
  // no name yet is left out.
  const draftUpdates = (o: ShopOrder, final: boolean): ItemUpdate[] =>
    checklistItems(o)
      .filter((item) => !item.addedByShop || (draft[item.id]?.name ?? item.name).trim())
      .map((item) => {
        const packedNow = (draft[item.id]?.status ?? item.status) === 'packed';
        const isNew = item.id.startsWith(NEW_ITEM);
        return {
          id: isNew ? undefined : item.id,
          name: item.addedByShop ? (draft[item.id]?.name ?? item.name).trim() : undefined,
          status: packedNow ? 'packed' : final ? 'unavailable' : 'pending',
          price: packedNow ? parsePrice(draft[item.id]?.price ?? '') : null,
        };
      });

  // Closing mid-packing keeps the ticks and prices already entered.
  const handleClose = () => {
    if (order && dirty && PACKING_STATUSES.includes(order.status)) {
      shopOrdersService.saveItems(order.id, draftUpdates(order, false)).catch(() => {});
      setDirty(false);
    }
    close();
  };

  /** Checks the list is complete, then asks for confirmation before sending the bill. */
  const handleSendBill = (o: ShopOrder) => {
    const updates = draftUpdates(o, true);
    if (!updates.some((item) => item.status === 'packed')) {
      showToast({ variant: 'info', title: t('shopOrders.nothingPackedTitle'), message: t('shopOrders.nothingPackedMessage') });
      return;
    }
    if (updates.some((item) => item.status === 'packed' && item.price == null)) {
      showToast({ variant: 'info', title: t('shopOrders.priceNeededTitle'), message: t('shopOrders.priceNeededMessage') });
      return;
    }
    Keyboard.dismiss();
    setConfirmBill(true);
  };

  const sendBill = (o: ShopOrder) => {
    saveItems.mutate(
      { id: o.id, items: draftUpdates(o, true) },
      {
        onSuccess: () => {
          setDirty(false);
          packed.mutate(
            { id: o.id },
            {
              onSuccess: () =>
                showToast({ variant: 'success', title: t('shopOrders.billSentTitle'), message: t('shopOrders.billSentMessage') }),
              onError,
              onSettled: () => setConfirmBill(false),
            },
          );
        },
        onError: (error) => {
          setConfirmBill(false);
          onError(error);
        },
      },
    );
  };

  const handleVerifyPin = (o: ShopOrder) => {
    verifyPin.mutate(
      { id: o.id, pin },
      {
        onSuccess: () => {
          Keyboard.dismiss();
          setPin('');
          showToast({ variant: 'success', title: t('shopOrders.completedTitle'), message: t('shopOrders.completedMessage') });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'ORDER_PIN_INVALID') {
            const left = (error.details as { attemptsLeft?: number } | undefined)?.attemptsLeft ?? 0;
            setPinError(t('shopOrders.pinWrong', { count: left }));
            setPin('');
            return;
          }
          onError(error);
        },
      },
    );
  };

  // --- Pieces ---

  const renderBanner = (o: ShopOrder) => {
    const bad = ['cancelled', 'declined', 'expired'].includes(o.status);
    const tone = bad ? brandColors.error : o.status === 'completed' ? brandColors.success : colors.primary;
    return (
      <View style={[styles.card, styles.banner, { backgroundColor: `${tone}12`, borderColor: `${tone}33` }]}>
        <View style={[styles.bannerIcon, { backgroundColor: tone }]}>
          <FontAwesome6 name={STATUS_ICONS[o.status]} size={16} color="#FFFFFF" solid />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>
            {o.quick && !o.businessId ? t('shopOrders.quickTitle') : t(`shopOrders.status.${o.status}.title`)}
          </Text>
          <Text style={[styles.bannerMessage, { color: colors.textMuted }]}>
            {o.quick && !o.businessId
              ? t('shopOrders.quickMessage')
              : o.status === 'cancelled' && o.cancelledBy === 'admin'
              ? t('shopOrders.adminCancelled')
              : t(`shopOrders.status.${o.status}.message`, { name: o.customerFullName })}
            {o.status === 'cancelled' && o.cancelReason
              ? ` ${t('job.reason', { reason: o.cancelReason === 'late' ? t('shopOrders.lateReason') : o.cancelReason })}`
              : ''}
          </Text>
        </View>
      </View>
    );
  };

  /** The order's steps with their times — the customer sees the same list. */
  const renderTimeline = (o: ShopOrder) => {
    const delivery = o.fulfillment === 'delivery';
    const endedAt = o.cancelledAt ?? o.declinedAt ?? o.expiredAt ?? null;
    const ended = ['cancelled', 'declined', 'expired'].includes(o.status);
    const steps: TimelineStep[] = [
      { key: 'placed', label: t('timeline.order.placed'), at: o.createdAt, done: true },
      { key: 'accepted', label: t('timeline.order.accepted'), at: o.acceptedAt ?? null, done: !!o.acceptedAt },
      { key: 'packed', label: t('timeline.order.packed'), at: o.packedAt ?? null, done: !!o.packedAt },
      {
        key: 'ready',
        label:
          delivery && o.deliveryStaff?.fullName
            ? t('timeline.order.outBy', { name: o.deliveryStaff.fullName })
            : t(delivery ? 'timeline.order.outForDelivery' : 'timeline.order.ready'),
        at: o.readyAt ?? null,
        done: !!o.readyAt,
      },
      {
        key: 'completed',
        label: o.deliveredByName ? t('timeline.order.deliveredBy', { name: o.deliveredByName }) : t('timeline.order.completed'),
        at: o.completedAt,
        done: !!o.completedAt,
      },
      { key: 'rated', label: t('timeline.order.rated'), at: null, done: o.shopRating != null },
    ];
    // Ended early: the steps it reached, then how it ended.
    const shown = ended
      ? [
          ...steps.filter((step) => step.at && step.key !== 'completed'),
          { key: 'ended', label: t(`timeline.order.${o.status}`), at: endedAt, done: true },
        ]
      : steps;
    return <StepTimeline title={t('timeline.title')} steps={shown} ended={ended} />;
  };

  const renderCustomer = (o: ShopOrder) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(o.customerFullName)}</Text>
        </LinearGradient>
        <View style={styles.flex}>
          <Text style={[styles.cardLabelInline, { color: colors.textMuted }]} numberOfLines={1}>
            {t('shopOrders.customer')}
            {manyShops && o.shopName ? ` · ${o.shopName}` : ''}
          </Text>
          <Text style={[styles.name, { color: colors.text }]}>{o.customerFullName}</Text>
          {o.customerMobileNumber ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>{o.customerMobileNumber}</Text>
          ) : (
            <Text style={[styles.meta, { color: colors.textMuted }]}>{t('shopOrders.numberAfterAccept')}</Text>
          )}
        </View>
        {o.customerMobileNumber ? (
          <Pressable
            style={[styles.roundButton, { backgroundColor: brandColors.success }]}
            onPress={() => callPhone(o.customerMobileNumber as string)}
          >
            <FontAwesome6 name="phone" size={15} color="#FFFFFF" solid />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
        <FontAwesome6 name={o.fulfillment === 'delivery' ? 'truck' : 'store'} size={13} color={colors.primary} solid />
        <Text style={[styles.infoText, { color: colors.text }]}>
          {o.fulfillment === 'delivery'
            ? t('shopOrders.deliverTo', {
                address: placeName(o.locationAddress) || t('shopOrders.customerLocation'),
                distance: formatDistance(o.distanceMeters),
              })
            : t('shopOrders.pickupFromShop')}
        </Text>
        {o.fulfillment === 'delivery' && ACTIVE_SHOP_STATUSES.includes(o.status) ? (
          <Pressable onPress={() => openDirections({ latitude: o.latitude, longitude: o.longitude })} hitSlop={8}>
            <Text style={[styles.link, { color: colors.primary }]}>{t('shopOrders.directions')}</Text>
          </Pressable>
        ) : null}
      </View>
      {o.note ? (
        <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
          <FontAwesome6 name="note-sticky" size={13} color={colors.primary} solid />
          <Text style={[styles.infoText, { color: colors.text }]}>{o.note}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderPlainList = (o: ShopOrder) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
        {o.items.length > 0 ? t('shopOrders.list', { count: o.items.length }) : t('shopOrders.listPhotos')}
      </Text>
      <ListPhotoStrip photos={o.listPhotoUrls ?? []} size={84} />
      {o.items.map((item, index) => (
        <View key={item.id} style={styles.plainRow}>
          <Text style={[styles.index, { color: colors.textMuted }]}>{index + 1}.</Text>
          <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</Text>
        </View>
      ))}
    </View>
  );

  // One tap ticks an item as packed (then its price); unticked means not packed.
  /** An item the shop typed in from the list's photo: its name and price, side by side. */
  const renderAddedItem = (item: ShopOrderItem) => {
    const entry = draft[item.id] ?? { status: item.status, price: '' };
    return (
      <View
        key={item.id}
        onLayout={(event) => {
          itemYs.current[item.id] = event.nativeEvent.layout.y;
        }}
        style={[styles.addedCard, { borderColor: `${colors.primary}33`, backgroundColor: `${colors.primary}08` }]}
      >
        <View style={styles.addedHead}>
          <View style={[styles.addedTag, { backgroundColor: `${colors.primary}14` }]}>
            <FontAwesome6 name="camera" size={10} color={colors.primary} solid />
            <Text style={[styles.addedTagText, { color: colors.primary }]}>{t('shopOrders.addedByYou')}</Text>
          </View>
          <Pressable
            onPress={() => removeItem(item.id)}
            hitSlop={8}
            accessibilityLabel={t('common.delete')}
            style={[styles.removeItem, { backgroundColor: `${brandColors.error}14` }]}
          >
            <FontAwesome6 name="xmark" size={12} color={brandColors.error} solid />
          </Pressable>
        </View>
        <View style={styles.addedRow}>
          <View style={[styles.fieldBox, styles.flex, { borderColor: `${colors.primary}40`, backgroundColor: colors.surface }]}>
            <FontAwesome6 name="basket-shopping" size={13} color={colors.textMuted} solid />
            <TextInput
              style={[styles.fieldInput, styles.flex, { color: colors.text }]}
              value={entry.name ?? item.name}
              onChangeText={(text) => setItem(item.id, { name: text.slice(0, 100), status: 'packed' })}
              placeholder={t('shopOrders.itemNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoFocus={focusNameId === item.id}
              onFocus={() => scrollToItem(item.id)}
              returnKeyType="next"
            />
          </View>
          <View style={[styles.fieldBox, styles.addedPrice, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
            <Text style={[styles.fieldRupee, { color: colors.text }]}>₹</Text>
            <TextInput
              style={[styles.fieldInput, styles.flex, { color: colors.text, fontFamily: fonts.semiBold }]}
              value={entry.price}
              onChangeText={(text) => setItem(item.id, { price: text.replace(/[^0-9.]/g, ''), status: 'packed' })}
              keyboardType="decimal-pad"
              placeholder={t('shopOrders.pricePlaceholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={9}
              accessibilityLabel={t('shopOrders.price')}
              onFocus={() => scrollToItem(item.id)}
              returnKeyType="done"
            />
          </View>
        </View>
      </View>
    );
  };

  const renderChecklistItem = (item: ShopOrderItem) => {
    if (item.addedByShop) return renderAddedItem(item);
    const entry = draft[item.id] ?? { status: item.status, price: '' };
    const checked = entry.status === 'packed';
    return (
      <View
        key={item.id}
        onLayout={(event) => {
          itemYs.current[item.id] = event.nativeEvent.layout.y;
        }}
        style={[
          styles.checkItem,
          {
            borderColor: checked ? brandColors.success : colors.border,
            backgroundColor: checked ? `${brandColors.success}0A` : colors.surface,
          },
        ]}
      >
        <Pressable
          style={styles.checkHeader}
          onPress={() => {
            setItem(item.id, { status: checked ? 'pending' : 'packed' });
            if (checked) {
              setFocusPriceId(null);
              Keyboard.dismiss();
            } else {
              setFocusPriceId(item.id);
            }
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <View
            style={[
              styles.checkbox,
              checked
                ? { backgroundColor: brandColors.success, borderColor: brandColors.success }
                : { borderColor: colors.textMuted },
            ]}
          >
            {checked ? <FontAwesome6 name="check" size={12} color="#FFFFFF" solid /> : null}
          </View>
          <View style={styles.flex}>
            <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</Text>
          </View>
          {checked ? (
            <View style={[styles.priceBox, { borderColor: colors.primary, backgroundColor: colors.background }]}>
              <Text style={[styles.rupee, { color: colors.text }]}>₹</Text>
              <TextInput
                style={[styles.priceInput, { color: colors.text }]}
                value={entry.price}
                onChangeText={(text) => setItem(item.id, { price: text.replace(/[^0-9.]/g, '') })}
                keyboardType="decimal-pad"
                placeholder={t('shopOrders.pricePlaceholder')}
                placeholderTextColor={colors.textMuted}
                maxLength={9}
                accessibilityLabel={t('shopOrders.price')}
                autoFocus={focusPriceId === item.id}
                onFocus={() => scrollToItem(item.id)}
                returnKeyType="done"
              />
            </View>
          ) : (
            <Text style={[styles.notPackedTag, { color: colors.textMuted }]}>{t('shopOrders.notPacked')}</Text>
          )}
        </Pressable>
      </View>
    );
  };

  const renderChecklist = (o: ShopOrder) => {
    const list = checklistItems(o);
    const photos = o.listPhotoUrls ?? [];
    const entries = list.map((item) => draft[item.id] ?? { status: item.status, price: '' });
    const packedCount = entries.filter((entry) => entry.status === 'packed').length;
    const notPackedCount = entries.length - packedCount;
    const itemsTotal = entries.reduce((sum, entry) => sum + (entry.status === 'packed' ? (parsePrice(entry.price) ?? 0) : 0), 0);
    const total = itemsTotal + (o.fulfillment === 'delivery' ? o.deliveryCharge : 0);
    return (
      <>
        <View style={styles.counters}>
          <View style={[styles.counter, { backgroundColor: `${brandColors.success}14` }]}>
            <Text style={[styles.counterValue, { color: brandColors.success }]}>{packedCount}</Text>
            <Text style={[styles.counterLabel, { color: colors.textMuted }]}>{t('shopOrders.packedCount')}</Text>
          </View>
          <View style={[styles.counter, { backgroundColor: `${colors.textMuted}14` }]}>
            <Text style={[styles.counterValue, { color: colors.text }]}>{notPackedCount}</Text>
            <Text style={[styles.counterLabel, { color: colors.textMuted }]}>{t('shopOrders.notPackedCount')}</Text>
          </View>
        </View>
        {photos.length > 0 ? (
          // A photo of a written list: read it, then type each item in with its price.
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('shopOrders.listPhotos')}</Text>
            <ListPhotoStrip photos={photos} size={84} />
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t('shopOrders.photoHint')}</Text>
          </View>
        ) : null}
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('shopOrders.checklistHint')}</Text>
        {list.map(renderChecklistItem)}
        <Pressable
          onPress={addItem}
          style={({ pressed }) => [styles.addItem, { borderColor: `${colors.primary}55`, backgroundColor: `${colors.primary}0A`, opacity: pressed ? 0.85 : 1 }]}
        >
          <FontAwesome6 name="plus" size={13} color={colors.primary} solid />
          <Text style={[styles.addItemText, { color: colors.primary }]}>{t('shopOrders.addItem')}</Text>
        </Pressable>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sumRow}>
            <Text style={[styles.sumLabel, { color: colors.textMuted }]}>{t('shopOrders.itemsTotal')}</Text>
            <Text style={[styles.sumValue, { color: colors.text }]}>{formatRupees(itemsTotal)}</Text>
          </View>
          {o.fulfillment === 'delivery' ? (
            <View style={styles.sumRow}>
              <Text style={[styles.sumLabel, { color: colors.textMuted }]}>{t('shopOrders.deliveryCharge')}</Text>
              <Text style={[styles.sumValue, { color: colors.text }]}>{formatRupees(o.deliveryCharge)}</Text>
            </View>
          ) : null}
          <View style={styles.sumRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>{t('shopOrders.total')}</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>{formatRupees(total)}</Text>
          </View>
        </View>
      </>
    );
  };

  const renderBill = (o: ShopOrder) => {
    const packedItems = o.items.filter((item) => item.status === 'packed');
    const missing = o.items.filter((item) => item.status === 'unavailable');
    const photos = o.listPhotoUrls ?? [];
    return (
      <>
        {photos.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('shopOrders.listPhotos')}</Text>
            <ListPhotoStrip photos={photos} size={84} />
          </View>
        ) : null}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('shopOrders.bill')}</Text>
          {packedItems.map((item) => (
            <View key={item.id} style={styles.plainRow}>
              <FontAwesome6 name="circle-check" size={13} color={brandColors.success} solid />
              <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {[item.quantity, item.unit].filter(Boolean).join(' ')}
              </Text>
              <Text style={[styles.price, { color: colors.text }]}>{formatRupees(item.price)}</Text>
            </View>
          ))}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {o.fulfillment === 'delivery' ? (
            <View style={styles.sumRow}>
              <Text style={[styles.sumLabel, { color: colors.textMuted }]}>{t('shopOrders.deliveryCharge')}</Text>
              <Text style={[styles.sumValue, { color: colors.text }]}>{formatRupees(o.deliveryCharge)}</Text>
            </View>
          ) : null}
          <View style={styles.sumRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>{t('shopOrders.total')}</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>{formatRupees(o.totalAmount)}</Text>
          </View>
        </View>
        {missing.length > 0 ? (
          <View style={[styles.card, { backgroundColor: `${brandColors.error}0D`, borderColor: `${brandColors.error}33` }]}>
            <Text style={[styles.cardLabel, { color: brandColors.error }]}>
              {t('shopOrders.notAvailableList', { count: missing.length })}
            </Text>
            {missing.map((item) => (
              <View key={item.id} style={styles.plainRow}>
                <FontAwesome6 name="circle-xmark" size={13} color={brandColors.error} solid />
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {[item.quantity, item.unit].filter(Boolean).join(' ')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </>
    );
  };

  const renderPinEntry = (o: ShopOrder) => (
    <View style={[styles.card, styles.pinCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
      <Text style={[styles.pinTitle, { color: colors.text }]}>{t('shopOrders.pinTitle')}</Text>
      <Text style={[styles.meta, styles.centerText, { color: colors.textMuted }]}>
        {t(o.fulfillment === 'delivery' ? 'shopOrders.pinHintDelivery' : 'shopOrders.pinHintPickup')}
      </Text>
      <Pressable style={styles.pinBoxes} onPress={() => pinInputRef.current?.focus()}>
        {[0, 1, 2, 3].map((index) => {
          const digit = pin[index];
          const borderColor = pinError ? brandColors.error : digit || index === pin.length ? colors.primary : colors.border;
          return (
            <View
              key={index}
              style={[styles.pinBox, { borderColor, backgroundColor: digit ? `${colors.primary}0D` : colors.background }]}
            >
              <Text style={[styles.pinDigit, { color: colors.text }]}>{digit ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          ref={pinInputRef}
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
        <Button
          label={t('shopOrders.verifyPin')}
          onPress={() =>
            runPin(async () => {
              if (await askForLocation()) handleVerifyPin(o);
            })
          }
          loading={verifyPin.isPending || pinBusy}
          disabled={pin.length !== 4}
        />
      </View>
    </View>
  );

  const renderRating = (o: ShopOrder) =>
    o.status === 'completed' ? (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('shopOrders.customerFeedback')}</Text>
        {o.shopRating ? (
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <FontAwesome6
                key={star}
                name="star"
                size={18}
                color={star <= (o.shopRating ?? 0) ? STAR_COLOR : colors.border}
                solid
              />
            ))}
          </View>
        ) : (
          <Text style={[styles.meta, { color: colors.textMuted }]}>{t('shopOrders.noRatingYet')}</Text>
        )}
        {o.shopReview ? <Text style={[styles.review, { color: colors.text }]}>“{o.shopReview}”</Text> : null}
      </View>
    ) : null;

  const renderStage = (o: ShopOrder) => {
    if (o.status === 'placed') {
      return (
        <>
          {renderPlainList(o)}
          <View style={styles.actionRow}>
            <Pressable style={[styles.secondaryButton, { borderColor: brandColors.error }]} onPress={() => setConfirm('decline')}>
              <Text style={[styles.secondaryText, { color: brandColors.error }]}>{t('shopOrders.decline')}</Text>
            </Pressable>
            <View style={styles.flex}>
              <Button
                label={t('shopOrders.accept')}
                onPress={() =>
                  accept.mutate(
                    { id: o.id },
                    { onSuccess: () => showToast({ variant: 'success', title: t('shopOrders.acceptedTitle') }), onError },
                  )
                }
                loading={accept.isPending}
                gradient={DONE_GRADIENT}
              />
            </View>
          </View>
        </>
      );
    }
    if (PACKING_STATUSES.includes(o.status)) {
      return (
        <>
          {renderChecklist(o)}
          <Button label={t('shopOrders.packingDone')} onPress={() => handleSendBill(o)} gradient={DONE_GRADIENT} />
        </>
      );
    }
    if (o.status === 'packed' && o.fulfillment === 'delivery') {
      // Deliver it yourself, or send it with one of the shop's delivery staff.
      return (
        <>
          {renderBill(o)}
          <DeliveryHandover
            order={o}
            onError={onError}
            deliverMyselfLoading={ready.isPending}
            onDeliverMyself={() =>
              ready.mutate(
                { id: o.id },
                { onSuccess: () => showToast({ variant: 'success', title: t('shopOrders.handedOverTitle') }), onError },
              )
            }
          />
        </>
      );
    }
    if (o.status === 'packed') {
      return (
        <>
          {renderBill(o)}
          <Button
            label={t(o.fulfillment === 'delivery' ? 'shopOrders.outForDelivery' : 'shopOrders.readyForPickup')}
            onPress={() =>
              ready.mutate(
                { id: o.id },
                { onSuccess: () => showToast({ variant: 'success', title: t('shopOrders.handedOverTitle') }), onError },
              )
            }
            loading={ready.isPending}
            gradient={DONE_GRADIENT}
          />
        </>
      );
    }
    if (o.status === 'out_for_delivery') {
      // With staff, they enter the PIN at the door; the owner can still take it back.
      return (
        <>
          <DeliveryHandover order={o} onError={onError} deliverMyselfLoading={false} onDeliverMyself={() => undefined} />
          {/* Always here: the owner can enter the PIN too (e.g. the staff member's phone is off). */}
          {renderPinEntry(o)}
          {renderBill(o)}
        </>
      );
    }
    if (o.status === 'ready_for_pickup') {
      return (
        <>
          {renderPinEntry(o)}
          {renderBill(o)}
        </>
      );
    }
    // Finished or ended: the bill (if there was one) and the customer's feedback.
    return (
      <>
        {o.status === 'completed' && o.deliveredByName ? (
          <View style={[styles.card, styles.deliveredBy, { backgroundColor: `${brandColors.success}0D`, borderColor: `${brandColors.success}55` }]}>
            <FontAwesome6 name="person-biking" size={16} color={brandColors.success} solid />
            <Text style={[styles.meta, styles.flex, { color: colors.text }]}>
              {t('deliveryStaff.deliveredBy', { name: o.deliveredByName, amount: formatRupees(o.totalAmount ?? 0) })}
            </Text>
          </View>
        ) : null}
        {renderRating(o)}
        {o.totalAmount != null ? renderBill(o) : renderPlainList(o)}
      </>
    );
  };

  const renderBody = () => {
    if (isLoading || !order) {
      return isError ? (
        <View style={styles.center}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>{t('shopOrders.loadFailed')}</Text>
          <View style={styles.fullWidth}>
            <Button label={t('common.retry')} onPress={() => refetch()} />
          </View>
        </View>
      ) : (
        <DetailSkeleton />
      );
    }
    const shopCanCancel = order.status === 'placed' ? false : ACTIVE_SHOP_STATUSES.includes(order.status);
    // Pull down for the latest (packing, delivery, PIN) — the staff member or customer may have moved it on.
    return (
      <PullToRefresh refreshing={pulling} onRefresh={pullRefresh} style={styles.flex}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderBanner(order)}
        {renderCustomer(order)}
        {renderTimeline(order)}
        {renderStage(order)}
        {shopCanCancel ? (
          <CancelButton
            label={t('shopOrders.cancelOrder')}
            hint={t('shopOrders.cancelHint')}
            onPress={() => setConfirm('cancel')}
          />
        ) : null}
      </ScrollView>
      </PullToRefresh>
    );
  };

  const confirming = confirm === 'decline' ? decline : cancel;
  return (
    <Modal visible={orderId !== null} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.container,
            { backgroundColor: colors.background, paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 },
          ]}
        >
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 14 }]}
          >
            <Pressable style={styles.backButton} onPress={handleClose} accessibilityLabel={t('common.close')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {order ? t(`shopOrders.status.${order.status}.title`) : t('timeline.orderDetails')}
              </Text>
              {order ? (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {`${order.customerFullName} · ${t(order.fulfillment === 'delivery' ? 'shopOrders.delivery' : 'shopOrders.pickup')}`}
                </Text>
              ) : (
                <View style={styles.subtitleBar} />
              )}
            </View>
          </LinearGradient>
          {renderBody()}
          <ToastHost />
        </View>

        {order ? (
          <ConfirmModal
            visible={confirmBill}
            icon="receipt"
            gradient={DONE_GRADIENT}
            title={t('shopOrders.confirmBillTitle')}
            message={(() => {
              const updates = draftUpdates(order, true);
              const packedItems = updates.filter((item) => item.status === 'packed');
              const itemsTotal = packedItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
              return t('shopOrders.confirmBillMessage', {
                packed: packedItems.length,
                notPacked: updates.length - packedItems.length,
                total: formatRupees(itemsTotal + (order.fulfillment === 'delivery' ? order.deliveryCharge : 0)),
              });
            })()}
            confirmLabel={t('shopOrders.sendBill')}
            loading={saveItems.isPending || packed.isPending}
            onConfirm={() => sendBill(order)}
            onCancel={() => setConfirmBill(false)}
          />
        ) : null}

        <ConfirmModal
          visible={confirm !== null}
          icon={confirm === 'decline' ? 'circle-xmark' : 'ban'}
          gradient={DANGER_GRADIENT}
          title={t(confirm === 'decline' ? 'shopOrders.declineConfirmTitle' : 'shopOrders.cancelConfirmTitle')}
          message={t(confirm === 'decline' ? 'shopOrders.declineConfirmMessage' : 'shopOrders.cancelConfirmMessage')}
          confirmLabel={t(confirm === 'decline' ? 'shopOrders.decline' : 'shopOrders.cancelOrder')}
          loading={confirming.isPending}
          onConfirm={() => {
            if (!order) return;
            confirming.mutate(
              { id: order.id },
              {
                onSuccess: () =>
                  showToast({
                    variant: 'info',
                    title: t(confirm === 'decline' ? 'shopOrders.declinedToast' : 'shopOrders.cancelledToast'),
                  }),
                onError,
                onSettled: () => setConfirm(null),
              },
            );
          }}
          onCancel={() => setConfirm(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  fullWidth: { alignSelf: 'stretch' },
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
  subtitleBar: { height: 10, width: 140, borderRadius: 5, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.3)' },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  body: { padding: 18, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16 },
  bannerMessage: { ...typography.caption, lineHeight: 18, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 16 },
  cardLabelInline: { ...typography.caption, fontSize: 11 },
  name: { ...typography.body, fontFamily: fonts.semiBold },
  meta: { ...typography.caption, fontSize: 12 },
  roundButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  infoText: { ...typography.body, fontSize: 13, flex: 1 },
  link: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  cardLabel: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  plainRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  index: { ...typography.caption, width: 20 },
  itemName: { ...typography.body, fontSize: 14, flex: 1 },
  price: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, minWidth: 64, textAlign: 'right' },
  counters: { flexDirection: 'row', gap: 10 },
  counter: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  counterValue: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 26 },
  counterLabel: { ...typography.caption, fontSize: 11 },
  hint: { ...typography.caption, lineHeight: 18 },
  addItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed' },
  addItemText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  addedCard: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  addedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addedTag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  addedTagText: { fontFamily: fonts.semiBold, fontSize: 11.5 },
  addedRow: { flexDirection: 'row', gap: 8 },
  addedPrice: { width: 110 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12 },
  fieldRupee: { fontFamily: fonts.semiBold, fontSize: 16 },
  fieldInput: {
    height: 46,
    paddingVertical: 0,
    fontFamily: fonts.regular,
    fontSize: 15,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  removeItem: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  checkItem: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  checkHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  notPackedTag: { ...typography.caption, fontSize: 11 },
  rupee: { fontFamily: fonts.semiBold, fontSize: 16 },
  // Left-aligned and narrow so the number sits right beside the ₹.
  priceInput: {
    minWidth: 48,
    maxWidth: 90,
    height: 40,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    textAlign: 'left',
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  sumLabel: { ...typography.body, fontSize: 13 },
  sumValue: { ...typography.body, fontFamily: fonts.medium, fontSize: 14 },
  totalLabel: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16 },
  totalValue: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 28 },
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  secondaryButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  pinCard: { alignItems: 'center', borderWidth: 1.5, gap: 6 },
  deliveredBy: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pinTitle: { ...typography.subheading, fontFamily: fonts.semiBold },
  pinBoxes: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 10, marginBottom: 4 },
  pinBox: { width: 54, height: 62, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pinDigit: { fontSize: 26, lineHeight: 34, fontFamily: fonts.semiBold, textAlign: 'center', includeFontPadding: false },
  pinHiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
  pinError: { ...typography.caption, fontFamily: fonts.medium, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 4 },
  review: { ...typography.body, fontStyle: 'italic', marginTop: 8 },
});
