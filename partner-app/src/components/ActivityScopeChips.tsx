import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, typography, useThemeColors } from '@/theme';
import { FullText } from '@/components/FullText';

export interface ScopeOption {
  /** `null` = everything (the first chip). */
  key: string | null;
  label: string;
  count: number;
}

/**
 * Activity: which of the partner's shops (or skills) the list is about — "All" first, then one
 * chip each, with how many entries it has. Only shown when there is more than one to choose from.
 */
export function ActivityScopeChips({
  icon,
  options,
  value,
  onChange,
}: {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  options: ScopeOption[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const { colors } = useThemeColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key ?? 'all'}
            onPress={() => onChange(option.key)}
            style={[
              styles.chip,
              active ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: `${colors.primary}26` },
            ]}
          >
            <FontAwesome6 name={option.key === null ? 'layer-group' : icon} size={11} color={active ? '#FFFFFF' : colors.primary} solid />
            <FullText style={[styles.label, { color: active ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
              {option.label}
            </FullText>
            <Text style={[styles.count, { color: active ? 'rgba(255,255,255,0.85)' : colors.textMuted }]}>{option.count}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 12 },
  row: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, height: 36, maxWidth: 220 },
  label: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, flexShrink: 1 },
  count: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
});
