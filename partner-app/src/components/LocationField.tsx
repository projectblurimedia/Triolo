import React, { useState } from 'react';
import { placeName } from '@/utils/formatAddress';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { LoadingIndicator } from './LoadingIndicator';
import { MapPickerModal } from './MapPickerModal';
import { fonts, typography, useThemeColors } from '@/theme';
import { PlaceValue, placeFromCoords } from '@/utils/place';
import { ensureLocationOn } from '@/utils/ensureLocationOn';
import { showToast } from '@/state/toastStore';

interface LocationFieldProps {
  label?: string;
  value: PlaceValue | null;
  onChange: (place: PlaceValue) => void;
}

const GPS_TIMEOUT_MS = 15000;

/**
 * Where you are: "Use my current location" (GPS) or "Select on map" — no typed address. Once
 * set, it shows only the place name (village / town); the full address found for that point is
 * kept in the value for storage and never shown.
 */
export function LocationField({ label, value, onChange }: LocationFieldProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [detecting, setDetecting] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const useCurrent = async () => {
    setDetecting(true);
    try {
      if (!(await ensureLocationOn())) {
        showToast({ variant: 'error', title: t('location.permissionDeniedTitle'), message: t('location.turnOnMessage') });
        return;
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), GPS_TIMEOUT_MS)),
      ]);
      onChange(await placeFromCoords(position.coords.latitude, position.coords.longitude));
    } catch {
      showToast({ variant: 'error', title: t('location.detectFailedTitle'), message: t('location.detectFailedMessage') });
    } finally {
      setDetecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label ?? t('location.addressLabel')}</Text>

      {value ? (
        <View style={[styles.placeCard, { borderColor: `${colors.success}55`, backgroundColor: `${colors.success}0F` }]}>
          <View style={[styles.placeIcon, { backgroundColor: `${colors.success}22` }]}>
            <FontAwesome6 name="location-dot" size={16} color={colors.success} solid />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={2}>
              {placeName(value.locationName) || value.locationName}
            </Text>
            <View style={styles.setRow}>
              <FontAwesome6 name="circle-check" size={10} color={colors.success} solid />
              <Text style={[styles.setText, { color: colors.success }]}>{t('location.placeSet')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.choice, { borderColor: colors.primary, backgroundColor: `${colors.primary}12` }]}
          onPress={useCurrent}
          disabled={detecting}
        >
          {detecting ? (
            <LoadingIndicator size={16} dotSize={3} color={colors.primary} />
          ) : (
            <FontAwesome6 name="location-crosshairs" size={15} color={colors.primary} solid />
          )}
          <Text style={[styles.choiceText, { color: colors.primary }]} numberOfLines={1}>
            {t(detecting ? 'location.detecting' : 'location.useCurrentShort')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.choice, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setMapOpen(true)}
          disabled={detecting}
        >
          <FontAwesome6 name="map-location-dot" size={15} color={colors.text} solid />
          <Text style={[styles.choiceText, { color: colors.text }]} numberOfLines={1}>
            {t('location.selectOnMap')}
          </Text>
        </Pressable>
      </View>

      <MapPickerModal
        visible={mapOpen}
        initial={value}
        onClose={() => setMapOpen(false)}
        onPick={(place) => {
          setMapOpen(false);
          onChange(place);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  flex: { flex: 1 },
  label: { ...typography.caption, marginBottom: 8 },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  placeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  placeName: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  setText: { ...typography.caption, fontSize: 11 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  choiceText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, flexShrink: 1 },
});
