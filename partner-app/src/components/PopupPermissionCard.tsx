import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LivePopup } from '../../modules/live-popup';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

type Missing = 'overlay' | 'fullScreen' | null;

// Closed with ✕: hidden until the app is opened again (this lives only as long as the app does).
let closedThisLaunch = false;

/** Which permission the pop-up still needs. The overlay check exists only on builds that have it. */
function missingPermission(): Missing {
  if (!LivePopup) return null;
  if (typeof LivePopup.canDrawOverlays === 'function' && !LivePopup.canDrawOverlays()) return 'overlay';
  if (!LivePopup.canUseFullScreen()) return 'fullScreen';
  return null;
}

/**
 * New jobs / orders open on screen by themselves (like a call) only with two Android settings:
 * "Display over other apps" (opens the app while the phone is in use) and, on Android 14+,
 * full-screen notifications (over the lock screen). This card asks for whichever is still off,
 * one at a time, and is checked again whenever the app comes back to the front.
 */
export function PopupPermissionCard() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [missing, setMissing] = useState<Missing>(() => missingPermission());
  const [closed, setClosed] = useState(closedThisLaunch);

  useEffect(() => {
    if (!LivePopup) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setMissing(missingPermission());
    });
    return () => subscription.remove();
  }, []);

  if (!missing || !LivePopup || closed) return null;
  const open = () => (missing === 'overlay' ? LivePopup?.openOverlaySettings() : LivePopup?.openFullScreenSettings());
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: `${brandColors.warning}12`, borderColor: `${brandColors.warning}66`, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: `${brandColors.warning}22` }]}>
        <FontAwesome6 name={missing === 'overlay' ? 'clone' : 'mobile-screen'} size={16} color={brandColors.warning} solid />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.title, { color: colors.text }]}>{t('livePopup.permissionTitle')}</Text>
        <Text style={[styles.text, { color: colors.textMuted }]}>
          {t(missing === 'overlay' ? 'livePopup.overlayText' : 'livePopup.permissionText')}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          closedThisLaunch = true;
          setClosed(true);
        }}
        hitSlop={10}
        accessibilityLabel={t('common.close')}
        style={[styles.close, { borderColor: colors.border }]}
      >
        <FontAwesome6 name="xmark" size={12} color={colors.textMuted} solid />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, padding: 12, marginBottom: 14 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  text: { ...typography.caption, fontSize: 12, lineHeight: 17 },
  close: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
