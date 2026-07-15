import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { fonts, headerGradient, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';

type FilterKey = 'services' | 'shops' | 'topRated' | 'nearby';

const FILTERS: { key: FilterKey; icon: keyof typeof FontAwesome5.glyphMap; labelKey: string }[] = [
  { key: 'services', icon: 'concierge-bell', labelKey: 'home.filterServices' },
  { key: 'shops', icon: 'store', labelKey: 'home.filterShops' },
  { key: 'topRated', icon: 'star', labelKey: 'home.filterTopRated' },
  { key: 'nearby', icon: 'map-marker-alt', labelKey: 'home.filterNearby' },
];

export function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);

  // Search/filtering isn't wired to anything yet — Worker/Business search isn't
  // built (see .cloud/project-context.md). This just toggles local UI state for now.
  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      <Text style={[styles.greeting, { color: colors.text }]}>
        {t('home.greeting', { name: account?.fullName ?? '' })}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('home.subtitle')}</Text>

      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <FontAwesome5 name="search" size={15} color={colors.textMuted} solid />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const isActive = activeFilters.includes(filter.key);
          return (
            <Pressable key={filter.key} onPress={() => toggleFilter(filter.key)}>
              {isActive ? (
                <LinearGradient
                  colors={headerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.filterChip}
                >
                  <FontAwesome5 name={filter.icon} size={11} color={colors.white} solid />
                  <Text style={[styles.filterLabel, { color: colors.white }]}>{t(filter.labelKey)}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.filterChip, styles.filterChipInactive, { borderColor: colors.border }]}>
                  <FontAwesome5 name={filter.icon} size={11} color={colors.textMuted} solid />
                  <Text style={[styles.filterLabel, { color: colors.text }]}>{t(filter.labelKey)}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 22, fontFamily: fonts.medium, marginTop: 20, marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: fonts.regular, marginBottom: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.regular,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  filterChipInactive: {
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
  },
});
