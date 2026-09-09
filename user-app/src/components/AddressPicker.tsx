import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TextField } from './TextField';
import { SelectField } from './SelectField';
import { LoadingIndicator } from './LoadingIndicator';
import { fonts, typography, useThemeColors } from '@/theme';
import { showToast } from '@/state/toastStore';
import { INDIA_DISTRICTS_BY_STATE, INDIA_STATES } from '@/constants/indiaLocations';

export interface AddressValue {
  latitude: number | null;
  longitude: number | null;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export const EMPTY_ADDRESS: AddressValue = {
  latitude: null,
  longitude: null,
  area: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
};

interface AddressPickerProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  /** Overrides the "use current location" button's tint — lets a screen with its own brand-distinct gradient (e.g. Business's orange) stay visually consistent instead of the default blue. */
  accentColor?: string;
}

/** Lowercased, whitespace-collapsed, "district"-suffix-stripped form for fuzzy comparison — a device's reverse-geocoder frequently returns e.g. "Hyderabad District" or extra spacing where the official list just has "Hyderabad". */
function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\bdistrict\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lookup against a fixed option list, tolerant of minor naming differences — returns the
 * list's own canonical spelling/casing, or undefined if nothing matches. Tries an exact
 * (normalized) match first; falls back to substring containment either direction, since a
 * GPS-reverse-geocoded name and this hand-maintained list don't share a common source of
 * truth (e.g. "Rangareddy" vs "Ranga Reddy", or a taluk/mandal name that's a substring of
 * its parent district).
 */
function matchInList(input: string | null | undefined, list: string[]): string | undefined {
  if (!input) return undefined;
  const normalizedInput = normalize(input);
  if (!normalizedInput) return undefined;
  const exact = list.find((item) => normalize(item) === normalizedInput);
  if (exact) return exact;
  return list.find((item) => {
    const normalizedItem = normalize(item);
    return normalizedItem.includes(normalizedInput) || normalizedInput.includes(normalizedItem);
  });
}

/**
 * Structured address entry — State/District as dropdowns constrained to India's actual
 * states and districts (`constants/indiaLocations.ts`), plus City/Area as free text and
 * Pincode as a 6-digit field. Replaces the earlier single free-text address field
 * (`LocationPicker`, still used unchanged by `RegisterScreen`'s account-level location —
 * this is a separate, Worker/Business-profile-specific component, not a swap-in-place of
 * that one) per explicit feedback that one manual field wasn't precise enough, and that
 * State/District specifically should be pick-from-a-list rather than free text (a typo'd
 * or inconsistently-cased state/district name would otherwise be useless for any future
 * area-based filtering). "Use my current location" still reverse-geocodes via
 * `expo-location` and pre-fills whatever it can — but State/District are only auto-filled
 * when the reverse-geocoded name actually matches an entry in the fixed list (`matchInList`
 * above); a name that doesn't match anything is left for manual dropdown selection rather
 * than silently storing an unlisted value in what's now a controlled field. Editing a field
 * afterward does NOT clear the detected `latitude`/`longitude` (unlike `LocationPicker`),
 * since correcting one field doesn't invalidate an otherwise-correct GPS fix.
 */
export function AddressPicker({ value, onChange, accentColor }: AddressPickerProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [detecting, setDetecting] = useState(false);
  const tint = accentColor ?? colors.primary;
  const districtOptions = value.state ? INDIA_DISTRICTS_BY_STATE[value.state] ?? [] : [];

  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  const handleStateChange = (state: string) => {
    const districts = INDIA_DISTRICTS_BY_STATE[state] ?? [];
    set({ state, district: districts.includes(value.district) ? value.district : '' });
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        showToast({
          variant: 'error',
          title: t('location.permissionDeniedTitle'),
          message: t('location.permissionDeniedMessage'),
        });
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const matchedState = matchInList(place?.region, INDIA_STATES) ?? value.state;
      const stateDistricts = INDIA_DISTRICTS_BY_STATE[matchedState] ?? [];
      // subregion/district/city, in that order — different Android/iOS geocoder versions
      // populate district-level info under different fields, so try each in turn rather
      // than committing to one and leaving the other two unused.
      const matchedDistrict =
        matchInList(place?.subregion, stateDistricts) ??
        matchInList(place?.district, stateDistricts) ??
        matchInList(place?.city, stateDistricts) ??
        (matchedState === value.state ? value.district : '');

      onChange({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        area: place?.street ?? place?.name ?? value.area,
        city: place?.city ?? place?.subregion ?? value.city,
        district: matchedDistrict,
        state: matchedState,
        pincode: place?.postalCode ?? value.pincode,
      });

      if (!matchedDistrict) {
        showToast({
          variant: 'info',
          title: t('location.gpsDetected'),
          message: matchedState ? t('location.selectDistrictManually') : t('location.selectStateAndDistrictManually'),
        });
      }
    } catch {
      showToast({ variant: 'error', title: t('location.detectFailedTitle'), message: t('location.detectFailedMessage') });
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
        label={t('location.areaLabel')}
        value={value.area}
        onChangeText={(text) => set({ area: text })}
        placeholder={t('location.areaPlaceholder')}
      />
      <View style={styles.row}>
        <View style={styles.rowField}>
          <SelectField
            label={t('location.stateLabel')}
            value={value.state}
            placeholder={t('location.selectStatePlaceholder')}
            options={INDIA_STATES}
            onChange={handleStateChange}
            searchPlaceholder={t('location.searchStatePlaceholder')}
            emptyMessage={t('location.noStatesFound')}
          />
        </View>
        <View style={styles.rowField}>
          <SelectField
            label={t('location.districtLabel')}
            value={value.district}
            placeholder={t('location.selectDistrictPlaceholder')}
            options={districtOptions}
            onChange={(district) => set({ district })}
            disabled={!value.state}
            disabledHint={t('location.selectStateFirst')}
            searchPlaceholder={t('location.searchDistrictPlaceholder')}
            emptyMessage={t('location.noDistrictsFound')}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rowField}>
          <TextField label={t('location.cityLabel')} value={value.city} onChangeText={(text) => set({ city: text })} />
        </View>
        <View style={styles.rowField}>
          <TextField
            label={t('location.pincodeLabel')}
            value={value.pincode}
            onChangeText={(text) => set({ pincode: text.replace(/[^0-9]/g, '').slice(0, 6) })}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
      </View>

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
  row: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -10, marginBottom: 12 },
  hintText: { ...typography.caption },
});
