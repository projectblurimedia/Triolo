import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { FontAwesome6 } from '@expo/vector-icons';
import { ThemePickerModal } from './ThemePickerModal';
import { LanguagePickerModal } from './LanguagePickerModal';
import { LogoutConfirmModal } from './LogoutConfirmModal';
import { SideMenuDrawer } from './SideMenuDrawer';
import { DrawerMenuItem } from './DrawerMenuItem';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useLogout, useUpdateAccountLanguage } from '@/hooks/useAuthMutations';
import { themeModeLabelKey, useThemeStore } from '@/state/themeStore';
import { languageLabelKey, useSettingsStore } from '@/state/settingsStore';

const LOGOUT_GRADIENT = ['#ef4444', '#dc2626'] as const;
const PURPLE_GRADIENT = ['#7C3AED', '#A78BFA'] as const;

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Profile's menu (language, theme, logout) — the same glass SideMenuDrawer as every other menu in the app. */
export function ProfileMenuModal({ visible, onClose }: ProfileMenuModalProps) {
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
      <SideMenuDrawer
        visible={visible}
        onClose={onClose}
        gradient={headerGradient}
        icon="shapes"
        title={t('profile.menuTitle')}
        subtitle={t('profile.menuSubtitle')}
      >
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('homeMenu.settingsSection')}</Text>
        <DrawerMenuItem
          icon="language"
          gradient={headerGradient}
          title={t('settings.language')}
          subtitle={t(languageLabelKey(language))}
          onPress={() => setLanguagePickerVisible(true)}
        />
        <DrawerMenuItem
          icon="palette"
          gradient={PURPLE_GRADIENT}
          title={t('settings.theme')}
          subtitle={t(themeModeLabelKey(themeMode))}
          onPress={() => setThemePickerVisible(true)}
        />

        <Pressable style={styles.logout} onPress={() => setLogoutConfirmVisible(true)}>
          <LinearGradient colors={LOGOUT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.logoutGradient}>
            <FontAwesome6 name="right-from-bracket" size={16} color="#FFFFFF" solid />
            <Text style={styles.logoutText}>{t('common.logout')}</Text>
          </LinearGradient>
        </Pressable>
      </SideMenuDrawer>

      <ThemePickerModal visible={themePickerVisible} onClose={() => setThemePickerVisible(false)} />
      <LanguagePickerModal
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        onChange={(next) => updateLanguage.mutate(next)}
      />
      <LogoutConfirmModal
        visible={logoutConfirmVisible}
        loading={logout.isPending}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutConfirmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  logout: { marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  logoutGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
  logoutText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
