import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemePickerModal } from './ThemePickerModal';
import { LanguagePickerModal } from './LanguagePickerModal';
import { LogoutConfirmModal } from './LogoutConfirmModal';
import { WorkerProfileModal } from './WorkerProfileModal';
import { BusinessProfileModal } from './BusinessProfileModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useLogout, useUpdateAccountLanguage } from '@/hooks/useAuthMutations';
import { themeModeLabelKey, useThemeStore } from '@/state/themeStore';
import { languageLabelKey, useSettingsStore } from '@/state/settingsStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;
const ICON_BUTTON_SIZE = 40;
const LOGOUT_GRADIENT = ['#ef4444', '#dc2626'] as const;

interface HomeMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Right-side drawer triggered from Home's header menu icon — Worker/Business entry points plus theme/logout. */
export function HomeMenuModal({ visible, onClose }: HomeMenuModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const themeMode = useThemeStore((state) => state.mode);
  const language = useSettingsStore((state) => state.language);
  const logout = useLogout();
  const updateLanguage = useUpdateAccountLanguage();
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [workerProfileVisible, setWorkerProfileVisible] = useState(false);
  const [businessProfileVisible, setBusinessProfileVisible] = useState(false);

  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // The native Modal must stay mounted for the full close animation, or the slide-out
  // gets cut short — but unlike a spring, a fixed-duration timing animation always
  // finishes in the same short, predictable window, so the Modal (which blocks all
  // touches, including the header's own menu button, while mounted) frees up input
  // again quickly and reliably rather than after an open-ended spring settle tail.
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!rendered) return;
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : DRAWER_WIDTH,
        duration: visible ? 280 : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 280 : 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!visible && finished) {
        setRendered(false);
      }
    });
  }, [visible, rendered]);

  const handleLogoutConfirm = () => {
    setLogoutConfirmVisible(false);
    onClose();
    logout.mutate();
  };

  const items = [
    {
      key: 'worker',
      icon: 'screwdriver-wrench' as const,
      gradient: headerGradient,
      title: t('homeMenu.registerWorkerTitle'),
      subtitle: t('homeMenu.registerWorkerSubtitle'),
      onPress: () => {
        onClose();
        setWorkerProfileVisible(true);
      },
    },
    {
      key: 'business',
      icon: 'store' as const,
      gradient: [colors.secondary, colors.warning] as const,
      title: t('homeMenu.registerBusinessTitle'),
      subtitle: t('homeMenu.registerBusinessSubtitle'),
      onPress: () => {
        onClose();
        setBusinessProfileVisible(true);
      },
    },
  ];

  return (
    <>
      <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
        <View style={styles.container}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
          </Pressable>

          <Animated.View style={[styles.drawer, { backgroundColor: colors.surface, transform: [{ translateX }] }]}>
            <LinearGradient
              colors={headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.header, { paddingTop: insets.top + 14 }]}
            >
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <FontAwesome6 name="shapes" size={28} color={colors.white} solid />
                  <View style={styles.headerText}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                      {t('homeMenu.title')}
                    </Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                      {t('homeMenu.subtitle')}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
                  <FontAwesome6 name="xmark" size={18} color={colors.white} solid />
                </Pressable>
              </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scrollContent}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('homeMenu.growSection')}</Text>
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.item, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={item.onPress}
                >
                  <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.itemIcon}>
                    <FontAwesome6 name={item.icon} size={18} color={colors.white} solid />
                  </LinearGradient>
                  <View style={styles.itemText}>
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>
                  <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
                </Pressable>
              ))}

              <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.textMuted }]}>
                {t('homeMenu.settingsSection')}
              </Text>
              <Pressable
                style={[styles.item, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setLanguagePickerVisible(true)}
              >
                <View style={[styles.itemIcon, { backgroundColor: `${colors.primary}20` }]}>
                  <FontAwesome6 name="language" size={18} color={colors.primary} solid />
                </View>
                <View style={styles.itemText}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {t('settings.language')}
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                    {t(languageLabelKey(language))}
                  </Text>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
              </Pressable>
              <Pressable
                style={[styles.item, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setThemePickerVisible(true)}
              >
                <View style={[styles.itemIcon, { backgroundColor: `${colors.primary}20` }]}>
                  <FontAwesome6 name="palette" size={18} color={colors.primary} solid />
                </View>
                <View style={styles.itemText}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {t('settings.theme')}
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                    {t(themeModeLabelKey(themeMode))}
                  </Text>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
              </Pressable>

              <Pressable style={styles.logout} onPress={() => setLogoutConfirmVisible(true)}>
                <LinearGradient colors={LOGOUT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.logoutGradient}>
                  <FontAwesome6 name="right-from-bracket" size={16} color={colors.white} solid />
                  <Text style={styles.logoutText}>{t('common.logout')}</Text>
                </LinearGradient>
              </Pressable>

              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: colors.textMuted }]}>{t('common.appName')}</Text>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

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
      <WorkerProfileModal visible={workerProfileVisible} onClose={() => setWorkerProfileVisible(false)} />
      <BusinessProfileModal visible={businessProfileVisible} onClose={() => setBusinessProfileVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 20 },
    }),
  },
  // paddingTop is overridden inline with insets.top + 14 — the same formula
  // GradientHeader uses — so this header's height always matches the app's own
  // top header regardless of device/notch, instead of a hardcoded guess.
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  headerText: { marginLeft: 12, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
  closeButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: ICON_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  sectionSpacing: { marginTop: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    paddingRight: 14,
    marginBottom: 10,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemText: { flex: 1, marginRight: 10 },
  itemTitle: { ...typography.body, fontFamily: fonts.semiBold },
  itemSubtitle: { ...typography.caption, marginTop: 2 },
  logout: {
    marginTop: 6,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  logoutText: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  footer: { alignItems: 'center', paddingTop: 4 },
  footerText: { ...typography.caption },
});
