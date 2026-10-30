import { ContinueModal } from './ContinueModal';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ThemePickerModal } from './ThemePickerModal';
import { LanguagePickerModal } from './LanguagePickerModal';
import { LogoutConfirmModal } from './LogoutConfirmModal';
import { NearbySearchModal, NearbySearchMode } from './NearbySearchModal';
import { SideMenuDrawer } from './SideMenuDrawer';
import { DrawerMenuItem } from './DrawerMenuItem';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useLogout, useUpdateAccountLanguage } from '@/hooks/useAuthMutations';
import { themeModeLabelKey, useThemeStore } from '@/state/themeStore';
import { languageLabelKey, useSettingsStore } from '@/state/settingsStore';
import { HireStaffModal } from './HireStaffModal';
import { withLocation } from '@/utils/ensureLocationOn';

const LOGOUT_GRADIENT = ['#ef4444', '#dc2626'] as const;
const PURPLE_GRADIENT = ['#7C3AED', '#A78BFA'] as const;

interface HomeMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Home's menu: nearby-worker/shop discovery plus language, theme and logout. Built on the same
 * glass SideMenuDrawer as every other menu in the app.
 */
export function HomeMenuModal({ visible, onClose }: HomeMenuModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const themeMode = useThemeStore((state) => state.mode);
  const language = useSettingsStore((state) => state.language);
  const logout = useLogout();
  const updateLanguage = useUpdateAccountLanguage();
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [nearbySearchMode, setNearbySearchMode] = useState<NearbySearchMode | null>(null);
  const [hireStaffVisible, setHireStaffVisible] = useState(false);
  const [continueVisible, setContinueVisible] = useState(false);

  const handleLogoutConfirm = () => {
    setLogoutConfirmVisible(false);
    onClose();
    logout.mutate();
  };

  const items = [
    {
      key: 'continue',
      icon: 'forward' as const,
      gradient: ['#16A34A', '#4ADE80'] as const,
      title: t('continueSteps.title'),
      subtitle: t('continueSteps.menuHint'),
      onPress: () => {
        onClose();
        setContinueVisible(true);
      },
    },
    {
      key: 'nearbyWorkers',
      icon: 'screwdriver-wrench' as const,
      gradient: headerGradient,
      title: t('homeMenu.nearbyWorkersTitle'),
      subtitle: t('homeMenu.nearbyWorkersSubtitle'),
      onPress: () => {
        onClose();
        withLocation(() => setNearbySearchMode('worker'));
      },
    },
    {
      key: 'nearbyShops',
      icon: 'store' as const,
      gradient: [colors.secondary, colors.warning] as const,
      title: t('homeMenu.nearbyShopsTitle'),
      subtitle: t('homeMenu.nearbyShopsSubtitle'),
      onPress: () => {
        onClose();
        withLocation(() => setNearbySearchMode('business'));
      },
    },
    {
      key: 'hireStaff',
      icon: 'user-tie' as const,
      gradient: ['#0D9488', '#2DD4BF'] as const,
      title: t('hireStaff.menuTitle'),
      subtitle: t('hireStaff.menuSubtitle'),
      onPress: () => {
        onClose();
        setHireStaffVisible(true);
      },
    },
  ];

  return (
    <>
      <SideMenuDrawer
        visible={visible}
        onClose={onClose}
        gradient={headerGradient}
        icon="shapes"
        title={t('homeMenu.title')}
        subtitle={t('homeMenu.subtitle')}
      >
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('homeMenu.exploreSection')}</Text>
        {items.map((item) => (
          <DrawerMenuItem
            key={item.key}
            icon={item.icon}
            gradient={item.gradient}
            title={item.title}
            subtitle={item.subtitle}
            onPress={item.onPress}
          />
        ))}

        <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.textMuted }]}>
          {t('homeMenu.settingsSection')}
        </Text>
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

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>{t('common.appName')}</Text>
        </View>
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
      <HireStaffModal visible={hireStaffVisible} onClose={() => setHireStaffVisible(false)} />
      <NearbySearchModal
        visible={nearbySearchMode !== null}
        mode={nearbySearchMode ?? 'worker'}
        onClose={() => setNearbySearchMode(null)}
      />
      <ContinueModal visible={continueVisible} onClose={() => setContinueVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  sectionSpacing: { marginTop: 8 },
  logout: { marginTop: 6, marginBottom: 20, borderRadius: 14, overflow: 'hidden' },
  logoutGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
  logoutText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  footer: { alignItems: 'center', paddingTop: 4 },
  footerText: { ...typography.caption },
});
