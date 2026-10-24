import React, { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts, typography, useThemeColors } from '@/theme';

const DONE_KEY = 'triolo-background-alerts-done';

/**
 * "Get job requests even when the app is closed." Many Android phones stop an app completely
 * when it's swiped away or battery saving is on, and a stopped app gets no push until it's
 * opened again — then every waiting request arrives at once. No code can lift that; the
 * partner has to allow it in Settings (auto-start, battery "No restrictions"). Shown on Home
 * until they tap Done, and again whenever notifications are turned off.
 */
export function BackgroundAlertsCard() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [done, setDone] = useState<boolean | null>(true);
  const [notificationsOff, setNotificationsOff] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const check = () => {
      AsyncStorage.getItem(DONE_KEY)
        .then((value) => setDone(value === '1'))
        .catch(() => setDone(false));
      Notifications.getPermissionsAsync()
        .then((permission) => setNotificationsOff(!permission.granted))
        .catch(() => undefined);
    };
    check();
    const subscription = AppState.addEventListener('change', (status) => status === 'active' && check());
    return () => subscription.remove();
  }, []);

  // Only when notifications are off: job offers are normal notifications now, which phones
  // deliver to a closed app like any other, so the auto-start / battery steps aren't needed.
  if (Platform.OS !== 'android' || !notificationsOff || done === null) return null;

  const finish = () => {
    setDone(true);
    AsyncStorage.setItem(DONE_KEY, '1').catch(() => undefined);
  };

  const steps = notificationsOff
    ? [t('backgroundAlerts.stepNotifications')]
    : [t('backgroundAlerts.stepAutostart'), t('backgroundAlerts.stepBattery'), t('backgroundAlerts.stepRecents')];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: `${colors.warning}66` }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: `${colors.warning}1F` }]}>
          <FontAwesome6 name="bell" size={16} color={colors.warning} solid />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {t(notificationsOff ? 'backgroundAlerts.offTitle' : 'backgroundAlerts.title')}
        </Text>
      </View>
      <Text style={[styles.message, { color: colors.textMuted }]}>{t('backgroundAlerts.message')}</Text>
      {steps.map((step, index) => (
        <View key={step} style={styles.step}>
          <Text style={[styles.stepNumber, { color: colors.primary }]}>{index + 1}.</Text>
          <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
        </View>
      ))}
      <View style={styles.actions}>
        {notificationsOff ? null : (
          <Pressable onPress={finish} accessibilityRole="button" style={[styles.button, { borderColor: colors.border }]}>
            <Text style={[styles.buttonText, { color: colors.text }]}>{t('backgroundAlerts.done')}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => Linking.openSettings().catch(() => undefined)}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.primary, borderColor: colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{t('location.openSettings')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 16, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  message: { ...typography.caption, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  step: { flexDirection: 'row', gap: 6 },
  stepNumber: { ...typography.caption, fontSize: 13, fontFamily: fonts.semiBold },
  stepText: { ...typography.caption, fontSize: 13, lineHeight: 19, flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...typography.body, fontFamily: fonts.semiBold },
});
