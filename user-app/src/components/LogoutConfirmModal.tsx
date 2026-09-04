import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, typography, useThemeColors } from '@/theme';

const LOGOUT_GRADIENT = ['#ef4444', '#dc2626'] as const;

interface LogoutConfirmModalProps {
  visible: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Centered destructive-action confirmation, modeled after a reference design — a distinct red treatment, unlike the app's brand-gradient primary actions. */
export function LogoutConfirmModal({ visible, loading, onConfirm, onCancel }: LogoutConfirmModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={LOGOUT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconCircle}>
            <FontAwesome6 name="right-from-bracket" size={26} color={colors.white} solid />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.text }]}>{t('profile.logoutConfirmTitle')}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{t('profile.logoutConfirmMessage')}</Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={onConfirm} disabled={loading}>
              <LinearGradient colors={LOGOUT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmGradient}>
                <FontAwesome6 name="right-from-bracket" size={15} color={colors.white} solid />
                <Text style={styles.confirmText}>{t('common.logout')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  card: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 24, alignItems: 'center' },
  iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 8, textAlign: 'center' },
  message: { ...typography.body, textAlign: 'center', marginBottom: 20 },
  buttonRow: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelButton: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  cancelText: { ...typography.body, fontFamily: fonts.medium },
  confirmButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  confirmText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
