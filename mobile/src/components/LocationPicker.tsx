import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TextField } from './TextField';
import { LoadingIndicator } from './LoadingIndicator';
import { fonts, typography, useThemeColors } from '@/theme';

export interface LocationValue {
  latitude: number | null;
  longitude: number | null;
  address: string;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  error?: string;
  /** Overrides the "use current location" button's tint — lets a screen with its own brand-distinct gradient (e.g. Business's orange) stay visually consistent instead of the default blue. */
  accentColor?: string;
}

/**
 * "Use my current location" (device GPS, reverse-geocoded to a readable address) with a
 * manual text fallback — no map/pin-drop UI exists yet, so manual entry only ever
 * produces an address string (latitude/longitude stay null until GPS succeeds). See
 * the "Planned Next" note in .cloud/project-context.md for the full GPS-coordinates
 * decision this implements.
 */
export function LocationPicker({ value, onChange, error, accentColor }: LocationPickerProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [detecting, setDetecting] = useState(false);
  const tint = accentColor ?? colors.primary;

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('location.permissionDeniedTitle'), t('location.permissionDeniedMessage'));
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const address = place
        ? [place.name, place.city ?? place.subregion, place.region].filter(Boolean).join(', ')
        : `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;

      onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude, address });
    } catch {
      Alert.alert(t('location.detectFailedTitle'), t('location.detectFailedMessage'));
    } finally {
      setDetecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.detectButton, { borderColor: tint, backgroundColor: `${tint}12` }]}
        onPress={handleDetect}
        disabled={detecting}
      >
        {detecting ? (
          <LoadingIndicator size={16} dotSize={3} color={tint} />
        ) : (
          <FontAwesome6 name="location-crosshairs" size={15} color={tint} solid />
        )}
        <Text style={[styles.detectText, { color: tint }]}>{t('location.useCurrent')}</Text>
      </Pressable>

      <TextField
        label={t('location.addressLabel')}
        value={value.address}
        onChangeText={(text) => onChange({ latitude: null, longitude: null, address: text })}
        placeholder={t('location.addressPlaceholder')}
        error={error}
        multiline
      />

      {value.latitude != null ? (
        <View style={styles.hintRow}>
          <FontAwesome6 name="circle-check" size={11} color={colors.success} solid />
          <Text style={[styles.hintText, { color: colors.success }]}>{t('location.gpsDetected')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 14,
  },
  detectText: { ...typography.body, fontFamily: fonts.semiBold },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -10, marginBottom: 12 },
  hintText: { ...typography.caption },
});
