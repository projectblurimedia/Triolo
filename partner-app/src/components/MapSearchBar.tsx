import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LoadingIndicator } from './LoadingIndicator';
import { fonts, typography, useThemeColors } from '@/theme';

/*
 * (Copied between user-app and partner-app — keep in sync.)
 */

interface Suggestion {
  key: string;
  title: string;
  detail: string;
  latitude: number;
  longitude: number;
}

// Photon: free OpenStreetMap place search with type-ahead, no API key (fair use — results are
// asked for only after typing pauses).
const SEARCH_URL = 'https://photon.komoot.io/api/';
const DEBOUNCE_MS = 400;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSuggestion(feature: any, index: number): Suggestion | null {
  const [longitude, latitude] = feature?.geometry?.coordinates ?? [];
  const p = feature?.properties ?? {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !p.name) return null;
  const detail = [p.city && p.city !== p.name ? p.city : null, p.district ?? p.county, p.state].filter(Boolean).join(', ');
  return { key: `${p.osm_id ?? index}-${index}`, title: p.name, detail, latitude, longitude };
}

/**
 * A search box over the map: type a village, town, area or landmark and pick one of the
 * suggestions (nearest to where the map is first) to move the map there.
 */
export function MapSearchBar({
  near,
  onPick,
}: {
  near: { latitude: number; longitude: number } | null;
  onPick: (latitude: number, longitude: number) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const requestId = useRef(0);
  // The text a suggestion put in the box: shown, but not searched again.
  const pickedText = useRef<string | null>(null);
  // Read when a search starts, so moving the map doesn't search again.
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    const text = query.trim();
    if (pickedText.current !== null && query === pickedText.current) {
      requestId.current += 1;
      setResults([]);
      setEmpty(false);
      setLoading(false);
      return;
    }
    pickedText.current = null;
    if (text.length < 2) {
      setResults([]);
      setEmpty(false);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const bias = nearRef.current ? `&lat=${nearRef.current.latitude}&lon=${nearRef.current.longitude}` : '';
        const response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(text)}&limit=8&lang=en${bias}`);
        const json = await response.json();
        if (id !== requestId.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const features: any[] = json?.features ?? [];
        const inIndia = features.filter((feature) => feature?.properties?.countrycode === 'IN');
        const list = (inIndia.length ? inIndia : features)
          .map(toSuggestion)
          .filter((item): item is Suggestion => item !== null)
          .slice(0, 6);
        setResults(list);
        setEmpty(list.length === 0);
      } catch {
        if (id === requestId.current) {
          setResults([]);
          setEmpty(true);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (item: Suggestion) => {
    Keyboard.dismiss();
    pickedText.current = item.title;
    setQuery(item.title);
    setResults([]);
    setEmpty(false);
    onPick(item.latitude, item.longitude);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: `${colors.primary}40` }]}>
        <FontAwesome6 name="magnifying-glass" size={14} color={colors.primary} solid />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('location.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          returnKeyType="search"
          autoCorrect={false}
        />
        {loading ? <LoadingIndicator size={16} dotSize={3} color={colors.primary} /> : null}
        {query.length > 0 && !loading ? (
          <Pressable
            onPress={() => {
              setQuery('');
              setResults([]);
            }}
            hitSlop={8}
            accessibilityLabel={t('common.clear')}
          >
            <FontAwesome6 name="circle-xmark" size={15} color={colors.textMuted} solid />
          </Pressable>
        ) : null}
      </View>
      {results.length > 0 || empty ? (
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {results.map((item, index) => (
            <Pressable
              key={item.key}
              onPress={() => pick(item)}
              style={({ pressed }) => [
                styles.row,
                index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                { backgroundColor: pressed ? `${colors.primary}10` : 'transparent' },
              ]}
            >
              <View style={[styles.rowIcon, { backgroundColor: `${colors.primary}14` }]}>
                <FontAwesome6 name="location-dot" size={12} color={colors.primary} solid />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.detail ? (
                  <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.detail}
                  </Text>
                ) : null}
              </View>
              <FontAwesome6 name="arrow-up-right-from-square" size={11} color={colors.textMuted} solid />
            </Pressable>
          ))}
          {empty ? <Text style={[styles.empty, { color: colors.textMuted }]}>{t('location.searchNone')}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { position: 'absolute', top: 12, left: 12, right: 12 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 0, includeFontPadding: false },
  list: { marginTop: 6, borderRadius: 16, borderWidth: 1, overflow: 'hidden', elevation: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rowIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  detail: { ...typography.caption, fontSize: 12 },
  empty: { ...typography.caption, fontSize: 12.5, textAlign: 'center', paddingVertical: 12 },
});
