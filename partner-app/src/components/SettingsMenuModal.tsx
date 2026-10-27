import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { FontAwesome6 } from '@expo/vector-icons';
import { ThemePickerModal } from './ThemePickerModal';
import { LanguagePickerModal } from './LanguagePickerModal';
import { ConfirmModal } from './ConfirmModal';
import { SideMenuDrawer } from './SideMenuDrawer';
import { DrawerMenuItem } from './DrawerMenuItem';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useLogout, useUpdateAccountLanguage } from '@/hooks/useAuthMutations';
import { themeModeLabelKey, useThemeStore } from '@/state/themeStore';
import { languageLabelKey, useSettingsStore } from '@/state/settingsStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { useMyJobPosts } from '@/hooks/useJobPost';
import { JobPostsSheet } from './JobPostsSheet';
import { useAuthStore } from '@/state/authStore';

// As many as the server allows (jobSeekers MAX_JOB_POSTS).
const MAX_JOB_POSTS = 5;
import { navigationRef } from '@/navigation/navigationRef';
import { MainStackParamList } from '@/navigation/types';

const LOGOUT_GRADIENT = ['#ef4444', '#dc2626'] as const;
const PURPLE_GRADIENT = ['#7C3AED', '#A78BFA'] as const;
const GREEN_GRADIENT = ['#16A34A', '#4ADE80'] as const;
const INDIGO_GRADIENT = ['#4338CA', '#7C3AED'] as const;

interface SettingsMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * The menu behind every tab's header `bars` icon — My Profiles (add or edit services, shop and
 * job post; Home only shows the ones that exist), then language, theme and logout. A right-side
 * drawer built on the same `SideMenuDrawer`/`DrawerMenuItem` as user-app's menus (copied, keep
 * in sync), so both apps' menus look and behave alike.
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
  const [postsOpen, setPostsOpen] = useState(false);
  const worker = useMyWorkerProfile().data;
  const shop = useMyBusinessProfile().data;
  const jobPosts = useMyJobPosts().data ?? [];
  const account = useAuthStore((state) => state.account);
  const jobPost = jobPosts[0] ?? null;

  // Closes the drawer, then opens the form on top of the tabs.
  const open = <K extends 'WorkerRegistration' | 'BusinessRegistration' | 'JobPost'>(
    route: K,
    params?: MainStackParamList[K],
  ) => {
    onClose();
    if (!navigationRef.isReady()) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigationRef.navigate as any)(route, params);
  };
  const statusLabel = (status: string) =>
    t(status === 'verified' ? 'verification.verified' : status === 'rejected' ? 'verification.rejected' : 'verification.pending');

  const handleLogoutConfirm = () => {
    setLogoutConfirmVisible(false);
    onClose();
    logout.mutate();
  };

  return (
    <>
      <JobPostsSheet
        visible={postsOpen}
        posts={jobPosts}
        name={account?.fullName}
        canAdd={jobPosts.length < MAX_JOB_POSTS}
        hint={t('jobPost.pickToEdit')}
        onClose={() => setPostsOpen(false)}
        onOpen={(post) => {
          setPostsOpen(false);
          if (navigationRef.isReady()) navigationRef.navigate('JobPost', { postId: post.id });
        }}
        onAdd={() => {
          setPostsOpen(false);
          if (navigationRef.isReady()) navigationRef.navigate('JobPost', {});
        }}
      />
      <SideMenuDrawer
        visible={visible}
        onClose={onClose}
        gradient={headerGradient}
        icon="shapes"
        title={t('settingsMenu.title')}
        subtitle={t('settingsMenu.subtitle')}
      >
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settingsMenu.profilesSection')}</Text>
        <DrawerMenuItem
          icon="screwdriver-wrench"
          gradient={headerGradient}
          title={t(worker ? 'settingsMenu.editServices' : 'settingsMenu.addServices')}
          subtitle={
            worker
              ? `${statusLabel(worker.verificationStatus)} · ${t('settingsMenu.tapToEdit')}`
              : t('settingsMenu.addServicesHint')
          }
          onPress={() => open('WorkerRegistration', worker ? { profile: worker } : undefined)}
        />
        <DrawerMenuItem
          icon="store"
          gradient={GREEN_GRADIENT}
          title={t(shop ? 'settingsMenu.editShop' : 'settingsMenu.addShop')}
          subtitle={
            shop ? `${statusLabel(shop.verificationStatus)} · ${t('settingsMenu.tapToEdit')}` : t('settingsMenu.addShopHint')
          }
          onPress={() => open('BusinessRegistration', shop ? { profile: shop } : undefined)}
        />
        <DrawerMenuItem
          icon="user-tie"
          gradient={INDIGO_GRADIENT}
          title={t(jobPost ? 'settingsMenu.editJobPost' : 'settingsMenu.addJobPost')}
          subtitle={
            jobPost
              ? jobPosts.length > 1
                ? t('settingsMenu.jobPostsCount', { count: jobPosts.length })
                : `${t(jobPost.isActive ? 'settingsMenu.jobPostLive' : 'settingsMenu.jobPostHidden')} · ${t('settingsMenu.tapToEdit')}`
              : t('settingsMenu.addJobPostHint')
          }
          onPress={() => {
            // None: make the first. One: edit it. Several: pick which one (a sheet over the app).
            if (!jobPost) return open('JobPost', {});
            if (jobPosts.length === 1) return open('JobPost', { postId: jobPost.id });
            onClose();
            setTimeout(() => setPostsOpen(true), 260);
          }}
        />

        <Text style={[styles.sectionTitle, styles.sectionGap, { color: colors.textMuted }]}>{t('settingsMenu.section')}</Text>
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
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  sectionGap: { marginTop: 14 },
  logout: { marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  logoutGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
  logoutText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
