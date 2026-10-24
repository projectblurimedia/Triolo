import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PullToRefresh } from './PullToRefresh';
import { LoadingIndicator } from './LoadingIndicator';
import { ConfirmModal } from './ConfirmModal';
import { SwipeableRow } from './SwipeableRow';
import { ToastHost } from './ToastHost';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import {
  useDeleteNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { AppNotification, NotificationType } from '@/services/notificationsService';
import { showToast } from '@/state/toastStore';
import { openSubscribe } from '@/state/subscribeStore';
import { useMySubscription } from '@/hooks/useSubscription';
import { useNotificationFocusStore } from '@/state/notificationFocusStore';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const TYPE_ICONS: Record<NotificationType, React.ComponentProps<typeof FontAwesome6>['name']> = {
  profile_view: 'eye',
  problem_accepted: 'user-check',
  problem_work_done: 'clipboard-check',
  problem_completed: 'circle-check',
  booking_accepted: 'user-check',
  booking_on_the_way: 'motorcycle',
  booking_arrived: 'location-dot',
  booking_work_done: 'clipboard-check',
  booking_completed: 'circle-check',
  booking_cancelled: 'ban',
  order_placed: 'basket-shopping',
  order_accepted: 'store',
  order_declined: 'circle-xmark',
  order_packed: 'receipt',
  order_ready: 'bag-shopping',
  order_out_for_delivery: 'truck-fast',
  order_completed: 'circle-check',
  order_cancelled: 'ban',
  badge_removed: 'shield-halved',
};

export function formatRelativeTime(iso: string, justNowLabel: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < MINUTE_MS) return justNowLabel;
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}m`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}h`;
  return `${Math.floor(diffMs / DAY_MS)}d`;
}

// Manual, not toLocale* — Hermes on Android doesn't reliably ship full Intl data.
function formatFullDate(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} · ${hour12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

/**
 * Full-screen notification centre (same component in user-app and partner-app — no shared
 * package, keep both copies in sync):
 *  - tap a notification to open it on its own (marks it read)
 *  - swipe a row left to reveal Delete
 *  - long-press a row (or tap "Select") to enter selection mode: every row gets a checkbox,
 *    with Select all and a bulk Delete (confirmed) at the bottom
 *  - "Mark all read" in the header while anything is unread
 * Renders its own ToastHost — the app-root one sits underneath this native Modal.
 */
export function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  // Solid (not translucent) so nothing behind the row can ever show through it.
  const selectedBackground = isDark ? '#16223A' : '#EAF2FF';
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotifications = useDeleteNotifications();

  const [openRowId, setOpenRowId] = useState<string | null>(null);
  // Rows currently showing their delete panel (sliding, open, or still sliding closed) —
  // their right corners go square so they meet the panel flush.
  const [revealedRowIds, setRevealedRowIds] = useState<Set<string>>(new Set());
  const setRowRevealed = (id: string, revealed: boolean) =>
    setRevealedRowIds((current) => {
      if (current.has(id) === revealed) return current;
      const next = new Set(current);
      if (revealed) next.add(id);
      else next.delete(id);
      return next;
    });
  // Only a user pull shows the spinner; the 15s background poll must not (it made the list
  // look like it was reloading constantly).
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<AppNotification | null>(null);
  const subscription = useMySubscription();
  const [confirmBulk, setConfirmBulk] = useState(false);

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  useEffect(() => {
    if (!visible) {
      setOpenRowId(null);
      setSelectionMode(false);
      setSelectedIds(new Set());
      setDetail(null);
      setConfirmBulk(false);
    }
  }, [visible]);

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // The rows go at once (optimistic), so the toast does too — no waiting for the server.
  // If the delete fails, the rows come back and an error toast replaces this one.
  const deleteIds = (ids: string[]) => {
    showToast({ variant: 'success', title: t('notifications.deletedToast', { count: ids.length }) });
    deleteNotifications.mutate(ids, {
      onError: () => showToast({ variant: 'error', title: t('common.errorTitle'), message: t('errors.generic') }),
    });
  };

  const openDetail = (item: AppNotification) => {
    setDetail(item);
    if (!item.isRead) markRead.mutate(item.id);
  };

  // Opened from a tapped push: show that notification once the list has it.
  const focusId = useNotificationFocusStore((state) => state.focusId);
  useEffect(() => {
    if (!visible || !focusId) return;
    const item = items.find((entry) => entry.id === focusId);
    if (item) {
      openDetail(item);
      useNotificationFocusStore.getState().clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, focusId, items]);

  const handleRowPress = (item: AppNotification) => {
    if (selectionMode) {
      toggleSelected(item.id);
    } else if (openRowId) {
      setOpenRowId(null);
    } else {
      openDetail(item);
    }
  };

  const handleRowLongPress = (item: AppNotification) => {
    if (selectionMode) return;
    setOpenRowId(null);
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  };

  const handleBack = () => {
    if (detail) setDetail(null);
    else if (selectionMode) exitSelection();
    else onClose();
  };

  const renderCheckbox = (checked: boolean) => (
    <View
      style={[
        styles.checkbox,
        checked ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.textMuted },
      ]}
    >
      {checked ? <FontAwesome6 name="check" size={11} color="#FFFFFF" solid /> : null}
    </View>
  );

  const renderItem = ({ item }: { item: AppNotification }) => {
    const selected = selectedIds.has(item.id);
    return (
      <SwipeableRow
        isOpen={openRowId === item.id}
        onOpen={() => setOpenRowId(item.id)}
        onClose={() => setOpenRowId((current) => (current === item.id ? null : current))}
        onRevealChange={(revealed) => setRowRevealed(item.id, revealed)}
        onDelete={() => {
          setOpenRowId(null);
          deleteIds([item.id]);
        }}
        deleteLabel={t('notifications.delete')}
        enabled={!selectionMode}
      >
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: selected ? selectedBackground : colors.surface,
              borderColor: selected ? colors.primary : item.isRead ? colors.border : `${colors.primary}66`,
            },
          ]}
          onPress={() => handleRowPress(item)}
          onLongPress={() => handleRowLongPress(item)}
          delayLongPress={350}
        >
          {selectionMode ? renderCheckbox(selected) : null}
          <View style={[styles.icon, { backgroundColor: `${colors.primary}1A` }]}>
            <FontAwesome6 name={TYPE_ICONS[item.type] ?? 'bell'} size={15} color={colors.primary} solid />
          </View>
          <View style={styles.cardBody}>
            {/* Title on the left, time (+ unread dot) on the right of the same line. */}
            <View style={styles.titleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.cardTime, { color: item.isRead ? colors.textMuted : colors.primary }]}>
                {formatRelativeTime(item.createdAt, t('notifications.justNow'))}
              </Text>
              {!item.isRead && !selectionMode ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
            </View>
            <Text style={[styles.cardMessage, { color: colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
              {item.body}
            </Text>
          </View>
        </Pressable>
      </SwipeableRow>
    );
  };

  // Actions sit in a toolbar under the header (the header carries only the title): an unread
  // summary on the left, labelled pills with icons on the right.
  const renderToolbar = () => {
    if (detail || items.length === 0) return null;
    const pill = (
      key: string,
      icon: React.ComponentProps<typeof FontAwesome6>['name'],
      label: string,
      onPress: () => void,
      filled = false,
      disabled = false,
    ) => (
      <Pressable
        key={key}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.toolPill,
          {
            backgroundColor: filled ? colors.primary : `${colors.primary}12`,
            borderColor: filled ? colors.primary : `${colors.primary}40`,
            opacity: disabled ? 0.6 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <FontAwesome6 name={icon} size={12} color={filled ? '#FFFFFF' : colors.primary} solid />
        <Text style={[styles.toolPillText, { color: filled ? '#FFFFFF' : colors.primary }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
    return (
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        {selectionMode ? (
          <View />
        ) : (
          <View style={styles.toolSummaryRow}>
            <View style={[styles.toolDot, { backgroundColor: unreadCount > 0 ? colors.primary : colors.success }]} />
            <Text style={[styles.toolSummary, { color: colors.text }]} numberOfLines={1}>
              {unreadCount > 0 ? t('notifications.unreadCount', { count: unreadCount }) : t('notifications.allCaughtUp')}
            </Text>
          </View>
        )}
        <View style={styles.toolActions}>
          {selectionMode
            ? pill(
                'all',
                allSelected ? 'square-minus' : 'square-check',
                t(allSelected ? 'notifications.deselectAll' : 'notifications.selectAll'),
                () => setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id))),
              )
            : [
                unreadCount > 0
                  ? pill(
                      'read',
                      'check-double',
                      t('notifications.markAllRead'),
                      () => markAllRead.mutate(),
                      true,
                      markAllRead.isPending,
                    )
                  : null,
                pill('select', 'list-check', t('notifications.select'), () => {
                  setOpenRowId(null);
                  setSelectionMode(true);
                }),
              ]}
        </View>
      </View>
    );
  };

  const headerTitle = detail
    ? t('notifications.detailTitle')
    : selectionMode
      ? t('notifications.selectedCount', { count: selectedIds.size })
      : t('notifications.title');
  const headerSubtitle = detail || selectionMode ? null : t('notifications.subtitle');

  const renderDetail = (item: AppNotification) => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.detailBody}
    >
      <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.detailIcon}>
          <FontAwesome6 name={TYPE_ICONS[item.type] ?? 'bell'} size={24} color="#FFFFFF" solid />
        </LinearGradient>
        <Text style={[styles.detailTitle, { color: colors.text }]}>{item.title}</Text>
        <View style={styles.detailTimeRow}>
          <FontAwesome6 name="clock" size={11} color={colors.textMuted} />
          <Text style={[styles.detailTime, { color: colors.textMuted }]}>{formatFullDate(item.createdAt)}</Text>
        </View>
        <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
        <Text style={[styles.detailMessage, { color: colors.text }]}>{item.body}</Text>
        {item.type === 'profile_view' && !item.viewer && subscription.data?.enabled && !subscription.data.active ? (
          <Pressable onPress={openSubscribe} hitSlop={6} style={styles.callWrap}>
            <Text style={[styles.subscribeLink, { color: colors.primary }]}>{t('notifications.seeWhoViewed')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        style={[styles.detailDelete, { borderColor: `${brandColors.error}59`, backgroundColor: `${brandColors.error}0D` }]}
        onPress={() => {
          const id = item.id;
          setDetail(null);
          deleteIds([id]);
        }}
      >
        <FontAwesome6 name="trash" size={14} color={brandColors.error} solid />
        <Text style={[styles.detailDeleteText, { color: brandColors.error }]}>{t('notifications.deleteThis')}</Text>
      </Pressable>
    </ScrollView>
  );

  const renderBody = () => {
    if (detail) return renderDetail(detail);
    if (isLoading) {
      return (
        <View style={styles.centerBody}>
          <LoadingIndicator size={40} dotSize={6} color={colors.primary} />
        </View>
      );
    }
    if (isError) {
      return (
        <View style={styles.centerBody}>
          <View style={[styles.emptyIcon, { backgroundColor: `${brandColors.error}1A` }]}>
            <FontAwesome6 name="triangle-exclamation" size={22} color={brandColors.error} solid />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('common.errorTitle')}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <View style={styles.centerBody}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}1A` }]}>
            <FontAwesome6 name="bell" size={22} color={colors.primary} solid />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('notifications.emptyTitle')}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('notifications.emptyMessage')}</Text>
        </View>
      );
    }
    return (
      <>
        {!selectionMode ? <Text style={[styles.hint, { color: colors.textMuted }]}>{t('notifications.gestureHint')}</Text> : null}
        <PullToRefresh
          refreshing={manualRefreshing}
          onRefresh={async () => {
            setManualRefreshing(true);
            try {
              await refetch();
            } finally {
              setManualRefreshing(false);
            }
          }}
        >
          <FlatList
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            extraData={{ openRowId, revealedRowIds, selectionMode, selectedIds }}
            contentContainerStyle={[styles.listContent, selectionMode ? { paddingBottom: 120 } : null]}
            onScrollBeginDrag={() => setOpenRowId(null)}
          />
        </PullToRefresh>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleBack} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={handleBack} accessibilityLabel={t('common.close')} hitSlop={8}>
              <FontAwesome6 name={selectionMode && !detail ? 'xmark' : 'chevron-left'} size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {headerTitle}
              </Text>
              {headerSubtitle ? (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {headerSubtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        {renderToolbar()}

        {renderBody()}

        {selectionMode && !detail ? (
          <View
            style={[
              styles.selectionBar,
              { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <Pressable
              style={[styles.deleteSelected, { opacity: selectedIds.size === 0 ? 0.5 : 1 }]}
              onPress={() => setConfirmBulk(true)}
              disabled={selectedIds.size === 0}
            >
              <LinearGradient
                colors={DELETE_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.deleteSelectedInner}
              >
                <FontAwesome6 name="trash" size={15} color="#FFFFFF" solid />
                <Text style={styles.deleteSelectedText}>{t('notifications.deleteSelected', { count: selectedIds.size })}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        <ToastHost />
      </View>

      <ConfirmModal
        visible={confirmBulk}
        icon="trash"
        gradient={DELETE_GRADIENT}
        title={t('notifications.deleteConfirmTitle', { count: selectedIds.size })}
        message={t('notifications.deleteConfirmMessage')}
        confirmLabel={t('notifications.delete')}
        loading={deleteNotifications.isPending}
        onConfirm={() => {
          const ids = [...selectedIds];
          setConfirmBulk(false);
          exitSelection();
          deleteIds(ids);
        }}
        onCancel={() => setConfirmBulk(false)}
      />
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  toolDot: { width: 8, height: 8, borderRadius: 4 },
  toolSummary: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, flexShrink: 1 },
  toolActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  toolPillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 8, textAlign: 'center' },
  emptyMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryButtonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  hint: { ...typography.caption, fontSize: 11, textAlign: 'center', marginTop: 12 },
  listContent: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  // alignSelf: center — the row itself is top-aligned (multi-line text), the checkbox is centred.
  cardSquareRight: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  cardMessage: { ...typography.caption, marginTop: 3, lineHeight: 16 },
  cardTime: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  detailBody: { padding: 20 },
  detailCard: { borderRadius: 20, borderWidth: 1, padding: 22, alignItems: 'center' },
  detailIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center', marginTop: 14 },
  detailTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  detailTime: { ...typography.caption },
  detailDivider: { height: 1, alignSelf: 'stretch', marginVertical: 18 },
  detailMessage: { ...typography.body, lineHeight: 22, alignSelf: 'stretch' },
  detailDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 18,
  },
  detailDeleteText: { ...typography.body, fontFamily: fonts.semiBold },
  callWrap: { alignSelf: 'stretch', marginTop: 18 },
  subscribeLink: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  selectionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  deleteSelected: { borderRadius: 16, overflow: 'hidden' },
  deleteSelectedInner: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteSelectedText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 15 },
});
