import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { FontAwesome6 } from '@expo/vector-icons';
import { ThemePickerModal } from './ThemePickerModal';
import { LanguagePickerModal } from './LanguagePickerModal';
import { ConfirmModal } from './ConfirmModal';
import { fonts, typography, useThemeColors } from '@/theme';
import { useLogout, useUpdateAccountLanguage } from '@/hooks/useAuthMutations';
import { themeModeLabelKey, useThemeStore } from '@/state/themeStore';
import { languageLabelKey, useSettingsStore } from '@/state/settingsStore';

const CLOSE_BUTTON_SIZE = 36;
const LOGOUT_GRADIENT = ['#ef4444', '#dc2626'] as const;

interface SettingsMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Bottom-sheet triggered from every tab's header menu icon — language, theme, and logout.
 * Adapted from user-app's ProfileMenuModal (same content, same mechanism — LanguagePickerModal/
 * ThemePickerModal are direct ports) but shared across all of this app's tabs rather than
 * Profile-only, since none of this app's tabs need distinct menu content the way user-app's
 * Home (onboarding entry points) differs from its Profile (settings only) — reuses the
 * existing generic ConfirmModal for the logout confirmation instead of porting a dedicated
 * LogoutConfirmModal, since this app already established ConfirmModal as its one destructive-
 * confirmation component (see ChooseCapabilityScreen).
 */
export function SettingsMenuModal({ visible, onClose }: SettingsMenuModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const themeMode = useThemeStore((state) => state.mode);
  const language = useSettingsStore((state) => state.language);
  const logout = useLogout();
  const updateLanguage = useUpdateAccountLanguage();
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  const handleLogoutConfirm = () => {
    setLogoutConfirmVisible(false);
    onClose();
    logout.mutate();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>{t('settingsMenu.title')}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityLabel={t('common.cancel')}
                style={[styles.closeButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <FontAwesome6 name="xmark" size={16} color={colors.textMuted} solid />
              </Pressable>
            </View>

            <Pressable
              style={[styles.card, styles.row, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setLanguagePickerVisible(true)}
            >
              <View style={styles.rowHeader}>
                <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}20` }]}>
                  <FontAwesome6 name="language" size={16} color={colors.primary} solid />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('settings.language')}</Text>
                  <Text style={[styles.rowValue, { color: colors.textMuted }]}>{t(languageLabelKey(language))}</Text>
                </View>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
            </Pressable>

            <Pressable
              style={[styles.card, styles.row, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setThemePickerVisible(true)}
            >
              <View style={styles.rowHeader}>
                <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}20` }]}>
                  <FontAwesome6 name="palette" size={16} color={colors.primary} solid />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('settings.theme')}</Text>
                  <Text style={[styles.rowValue, { color: colors.textMuted }]}>{t(themeModeLabelKey(themeMode))}</Text>
                </View>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
            </Pressable>

            <Pressable style={styles.logout} onPress={() => setLogoutConfirmVisible(true)}>
              <LinearGradient colors={LOGOUT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.logoutGradient}>
                <FontAwesome6 name="right-from-bracket" size={16} color="#FFFFFF" solid />
                <Text style={styles.logoutText}>{t('common.logout')}</Text>
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ThemePickerModal visible={themePickerVisible} onClose={() => setThemePickerVisible(false)} />
      <LanguagePickerModal
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        onChange={(next) => updateLanguage.mutate(next)}
      />
      <ConfirmModal
        visible={logoutConfirmVisible}
        icon="right-from-bracket"
        gradient={LOGOUT_GRADIENT}
        title={t('chooseCapability.logoutConfirmTitle')}
        message={t('chooseCapability.logoutConfirmMessage')}
        confirmLabel={t('common.logout')}
        loading={logout.isPending}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutConfirmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  closeButton: {
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: CLOSE_BUTTON_SIZE / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 18 },
  rowHeader: { flex: 1, marginRight: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1 },
  label: { ...typography.body, fontFamily: fonts.semiBold },
  rowValue: { ...typography.caption, marginTop: 2 },
  logout: {
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  logoutText: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
