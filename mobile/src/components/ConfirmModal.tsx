import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, typography, useThemeColors } from '@/theme';

interface ConfirmModalProps {
  visible: boolean;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  gradient: readonly [string, string];
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Generic destructive/important-action confirmation — same centered-card shell as
 * LogoutConfirmModal (icon circle, title/message, Cancel + gradient confirm button) but
 * parameterized so other flows (delete profile, etc.) don't need their own one-off modal.
 */
export function ConfirmModal({
  visible,
  icon,
  gradient,
  title,
  message,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconCircle}>
            <FontAwesome6 name={icon} size={26} color={colors.white} solid />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={onConfirm} disabled={loading}>
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmGradient}>
                <Text style={styles.confirmText}>{confirmLabel}</Text>
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
