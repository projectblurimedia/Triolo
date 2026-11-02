import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { pushTokenService } from '@/services/pushTokenService';
import { useAuthStore } from '@/state/authStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { ToastHost } from './ToastHost';
import { fonts, typography, useThemeColors } from '@/theme';

/*
 * (Copied between user-app and partner-app — keep in sync.)
 */

const DANGER = ['#ef4444', '#dc2626'] as const;
/** What deleting removes, in order (keys under deleteAccount.points). */
const POINTS = ['active', 'profiles', 'media', 'signedOut', 'kept', 'wiped'] as const;
const POINT_ICONS: Record<(typeof POINTS)[number], string> = {
  active: 'ban',
  profiles: 'id-card',
  media: 'images',
  signedOut: 'right-from-bracket',
  kept: 'clock-rotate-left',
  wiped: 'trash-can',
};

/**
 * Profile menu → Delete account. Says exactly what happens, needs a tick to confirm, then
 * deletes (`DELETE /account`): everything under way is cancelled, profiles, photos and voice
 * messages go at once, the phone is signed out; the account's details are wiped 30 days later.
 */
export function DeleteAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible) setUnderstood(false);
  }, [visible]);

  const remove = async () => {
    if (!understood || deleting) return;
    setDeleting(true);
    try {
      await pushTokenService.remove().catch(() => undefined);
      await apiClient.delete<null>('/account', true);
      onClose();
      queryClient.clear();
      clearSession();
      showToast({ variant: 'success', title: t('deleteAccount.doneTitle'), message: t('deleteAccount.doneMessage') });
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => !deleting && onClose()}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LinearGradient colors={DANGER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={onClose} disabled={deleting} hitSlop={8} style={styles.back}>
            <FontAwesome6 name="chevron-left" size={16} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t('deleteAccount.title')}</Text>
            <Text style={styles.subtitle}>{t('deleteAccount.subtitle')}</Text>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.warn, { backgroundColor: '#ef44441A', borderColor: '#ef444455' }]}>
            <FontAwesome6 name="triangle-exclamation" size={18} color="#dc2626" solid />
            <Text style={[styles.warnText, { color: colors.text }]}>{t('deleteAccount.warning')}</Text>
          </View>

          <Text style={[styles.section, { color: colors.text }]}>{t('deleteAccount.whatHappens')}</Text>
          {POINTS.map((point) => (
            <View key={point} style={[styles.point, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.pointIcon}>
                <FontAwesome6 name={POINT_ICONS[point]} size={13} color="#dc2626" solid />
              </View>
              <Text style={[styles.pointText, { color: colors.text }]}>{t(`deleteAccount.points.${point}`)}</Text>
            </View>
          ))}

          <Pressable onPress={() => setUnderstood((value) => !value)} style={styles.tickRow} hitSlop={6}>
            <View style={[styles.tick, { borderColor: understood ? '#dc2626' : colors.border, backgroundColor: understood ? '#dc2626' : 'transparent' }]}>
              {understood ? <FontAwesome6 name="check" size={11} color="#FFFFFF" solid /> : null}
            </View>
            <Text style={[styles.tickText, { color: colors.text }]}>{t('deleteAccount.understand')}</Text>
          </Pressable>

          <Pressable onPress={remove} disabled={!understood || deleting} style={{ opacity: understood ? 1 : 0.45 }}>
            <LinearGradient colors={DANGER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <FontAwesome6 name="trash-can" size={15} color="#FFFFFF" solid />
                  <Text style={styles.buttonText}>{t('deleteAccount.confirm')}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onClose} disabled={deleting} style={styles.cancel}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>{t('deleteAccount.keep')}</Text>
          </Pressable>
        </ScrollView>
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 48, paddingBottom: 18, paddingHorizontal: 16 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...typography.heading, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 20 },
  subtitle: { ...typography.caption, color: 'rgba(255,255,255,0.9)' },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  warnText: { ...typography.body, fontFamily: fonts.medium, flex: 1, fontSize: 14, lineHeight: 20 },
  section: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 8 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  pointIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef44441A', alignItems: 'center', justifyContent: 'center' },
  pointText: { ...typography.body, flex: 1, fontSize: 13.5, lineHeight: 19 },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, paddingVertical: 6 },
  tick: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tickText: { ...typography.body, flex: 1, fontSize: 14 },
  button: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6 },
  buttonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 15 },
  cancel: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { ...typography.body, fontFamily: fonts.medium },
});
