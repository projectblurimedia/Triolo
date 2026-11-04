import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

export interface FilterChipOption<K extends string> {
  key: K;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  count?: number;
}

/**
 * One row of filters under a list's header (My Bookings, My Orders): the chosen one is a blue
 * gradient pill, each shows how many it holds. Centred when they fit, scrolls sideways when not.
 */
export function FilterChips<K extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const { colors } = useThemeColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const on = option.key === value;
        const content = (
          <>
            <FontAwesome6 name={option.icon} size={11} color={on ? '#FFFFFF' : colors.primary} solid />
            <Text style={[styles.label, { color: on ? '#FFFFFF' : colors.text }]}>{option.label}</Text>
            {option.count !== undefined ? (
              <View style={[styles.count, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : `${colors.primary}16` }]}>
                <Text style={[styles.countText, { color: on ? '#FFFFFF' : colors.primary }]}>{option.count}</Text>
              </View>
            ) : null}
          </>
        );
        return (
          <Pressable key={option.key} onPress={() => onChange(option.key)} accessibilityState={{ selected: on }}>
            {on ? (
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                {content}
              </LinearGradient>
            ) : (
              <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: `${colors.primary}26`, borderWidth: 1 }]}>
                {content}
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginTop: 14 },
  row: { gap: 8, paddingHorizontal: 16, flexGrow: 1, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingLeft: 12, paddingRight: 6 },
  label: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16, includeFontPadding: false },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14, includeFontPadding: false },
});
