import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingIndicator } from './LoadingIndicator';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/useNotifications';
import { AppNotification } from '@/services/notificationsService';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatRelativeTime(iso: string, justNowLabel: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < MINUTE_MS) return justNowLabel;
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}m`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}h`;
  return `${Math.floor(diffMs / DAY_MS)}d`;
}

/**
 * First slice of real, in-app notifications (Pending Module 6) — polled (see
 * `useNotifications`), not push/FCM yet. Opened from every tab's header bell icon
 * (`MainTabNavigator`), same "modal rendered as a sibling of the tab navigator, own
 * visibility state" pattern `SettingsMenuModal` already established. A full-screen list
 * rather than a bottom sheet (unlike `SettingsMenuModal`) since the content here can grow —
 * a handful of settings rows fits a sheet, an open-ended notification history doesn't.
 * Deliberately doesn't reuse `GradientHeader`'s own `showBack` — that calls the enclosing
 * navigator's `goBack()`, which would try to navigate the real screen stack instead of just
 * closing this locally-controlled modal, so the header here is self-contained instead.
 */
export function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const renderItem = ({ item }: { item: AppNotification }) => (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: item.isRead ? colors.border : colors.primary },
      ]}
      onPress={() => !item.isRead && markRead.mutate(item.id)}
    >
      <View style={[styles.icon, { backgroundColor: `${colors.primary}1A` }]}>
        <FontAwesome6 name="eye" size={15} color={colors.primary} solid />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.cardMessage, { color: colors.textMuted }]}>{item.body}</Text>
        <Text style={[styles.cardTime, { color: colors.textMuted }]}>
          {formatRelativeTime(item.createdAt, t('notifications.justNow'))}
        </Text>
      </View>
      {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
    </Pressable>
  );

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
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.close')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t('notifications.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('notifications.subtitle')}
              </Text>
            </View>
            {unreadCount > 0 ? (
              <Pressable
                onPress={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                accessibilityLabel={t('notifications.markAllRead')}
                style={styles.markAllButton}
              >
                <Text style={styles.markAllButtonText} numberOfLines={1}>
                  {t('notifications.markAllRead')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </LinearGradient>

        {isLoading ? (
          <View style={styles.body}>
            <LoadingIndicator size={40} dotSize={6} color={colors.primary} />
          </View>
        ) : isError ? (
          <View style={styles.body}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.error}1A` }]}>
              <FontAwesome6 name="triangle-exclamation" size={22} color={colors.error} solid />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('common.errorTitle')}</Text>
            <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.body}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}1A` }]}>
              <FontAwesome6 name="bell" size={22} color={colors.primary} solid />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('notifications.emptyTitle')}</Text>
            <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('notifications.emptyMessage')}</Text>
          </View>
        ) : (
          <FlatList data={items} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} />
        )}
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
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
  },
  markAllButtonText: { ...typography.caption, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 8, textAlign: 'center' },
  emptyMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryButtonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  listContent: { padding: 20, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold },
  cardMessage: { ...typography.caption, marginTop: 2, lineHeight: 16 },
  cardTime: { ...typography.caption, fontSize: 11, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
