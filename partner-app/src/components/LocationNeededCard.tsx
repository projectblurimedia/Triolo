import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { fonts, headerGradient, typography } from '@/theme';

/**
 * "Turn on location" — shown at the top of Home and Bookings whenever location is off,
 * denied or can't be found (like the customer app's Home card). Nothing while it's fine
 * or still being checked. The button opens the system dialog or Settings.
 */
export function LocationNeededCard() {
  const { t } = useTranslation();
  const { location, refresh } = useDeviceLocation();

  if (location.status === 'ready' || location.status === 'loading') return null;

  const title =
    location.status === 'disabled'
      ? t('location.disabledTitle')
      : location.status === 'denied'
        ? t('location.neededTitle')
        : t('location.errorTitle');
  const message =
    location.status === 'denied' && !location.canAskAgain
      ? t('location.deniedForeverMessage')
      : location.status === 'error'
        ? t('location.errorMessage')
        : t('location.partnerNeededMessage');

  return (
    <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
        <View style={styles.icon}>
          <FontAwesome6 name="location-crosshairs" size={22} color="#FFFFFF" solid />
        </View>
      </View>
      <Pressable style={styles.button} onPress={refresh} accessibilityRole="button">
        <Text style={styles.buttonText}>{locationActionLabel(location, t)}</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 18, gap: 12, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  message: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', marginTop: 4 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
