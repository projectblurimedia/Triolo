import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { GlassBackdrop, GlassCard } from './Glass';
import { ALL_TIME, DateRange, DateRangeSheet, rangeLabel } from './DateRangeSheet';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

export interface FilterOption<T extends string> {
  key: T;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  count: number;
}

/**
 * Activity's filter bar: one card saying what the list shows ("All · 12") and when, with a
 * Filter button (a sheet of choices — All, Requests, In progress, Completed, Cancelled… — each
 * with its count) and a Dates button. One list, narrowed down — instead of separate tabs.
 */
export function ActivityFilter<T extends string>({
  value,
  options,
  onChange,
  range,
  onRangeChange,
}: {
  value: T;
  options: FilterOption<T>[];
  onChange: (next: T) => void;
  /** From – to dates the list is narrowed to (with a Dates button). */
  range?: DateRange;
  onRangeChange?: (next: DateRange) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [open, setOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const datesText = range ? rangeLabel(range, t) : null;
  const current = options.find((option) => option.key === value) ?? options[0];
  const filtered = value !== options[0].key;

  return (
    <>
      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: `${colors.primary}26` }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.currentIcon}>
          <FontAwesome6 name={current.icon} size={13} color="#FFFFFF" solid />
        </LinearGradient>
        <View style={styles.flex}>
          <View style={styles.currentRow}>
            <Text style={[styles.current, { color: colors.text }]} numberOfLines={1}>
              {current.label}
            </Text>
            <View style={[styles.count, { backgroundColor: `${colors.primary}14` }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>{current.count}</Text>
            </View>
          </View>
          <Text style={[styles.when, { color: colors.textMuted }]} numberOfLines={1}>
            {datesText ?? t('dateRange.all')}
          </Text>
        </View>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('activity.filter')}
          style={({ pressed }) => [styles.buttonWrap, { opacity: pressed ? 0.85 : 1 }]}
        >
          {filtered ? (
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
              <FontAwesome6 name="sliders" size={13} color="#FFFFFF" solid />
            </LinearGradient>
          ) : (
            <View style={[styles.button, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}40`, borderWidth: 1 }]}>
              <FontAwesome6 name="sliders" size={13} color={colors.primary} solid />
            </View>
          )}
        </Pressable>
        {range && onRangeChange ? (
          <Pressable
            onPress={() => setDatesOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('dateRange.title')}
            style={({ pressed }) => [styles.buttonWrap, { opacity: pressed ? 0.85 : 1 }]}
          >
            {datesText ? (
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
                <FontAwesome6 name="calendar-days" size={13} color="#FFFFFF" solid />
              </LinearGradient>
            ) : (
              <View style={[styles.button, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}40`, borderWidth: 1 }]}>
                <FontAwesome6 name="calendar-days" size={13} color={colors.primary} solid />
              </View>
            )}
          </Pressable>
        ) : null}
      </View>
      {/* The chosen dates, with a way to clear them. */}
      {datesText && onRangeChange ? (
        <View style={[styles.rangeChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}>
          <FontAwesome6 name="calendar-check" size={11} color={colors.primary} solid />
          <Text style={[styles.rangeText, { color: colors.primary }]} numberOfLines={1}>
            {datesText}
          </Text>
          <Pressable onPress={() => onRangeChange(ALL_TIME)} hitSlop={8} accessibilityLabel={t('dateRange.clear')} style={styles.rangeClear}>
            <FontAwesome6 name="xmark" size={10} color="#FFFFFF" solid />
          </Pressable>
        </View>
      ) : null}
      {range && onRangeChange ? (
        <DateRangeSheet visible={datesOpen} value={range} onClose={() => setDatesOpen(false)} onApply={onRangeChange} />
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <GlassBackdrop onPress={() => setOpen(false)} style={styles.overlay}>
          <GlassCard style={styles.sheet}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetHead}>
              <View style={styles.sheetHeadIcon}>
                <FontAwesome6 name="sliders" size={14} color="#FFFFFF" solid />
              </View>
              <Text style={styles.sheetTitle}>{t('activity.filterTitle')}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8} style={styles.sheetClose} accessibilityLabel={t('common.close')}>
                <FontAwesome6 name="xmark" size={13} color="#FFFFFF" solid />
              </Pressable>
            </LinearGradient>
            <View style={styles.options}>
              {options.map((option) => {
                const active = option.key === value;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      onChange(option.key);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: active ? `${colors.primary}14` : colors.background,
                        borderColor: active ? colors.primary : colors.border,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: active ? colors.primary : `${colors.primary}14` }]}>
                      <FontAwesome6 name={option.icon} size={12} color={active ? '#FFFFFF' : colors.primary} solid />
                    </View>
                    <Text style={[styles.optionText, { color: colors.text }]} numberOfLines={1}>
                      {option.label}
                    </Text>
                    <View style={[styles.optionCount, { backgroundColor: active ? colors.primary : `${colors.textMuted}1A` }]}>
                      <Text style={[styles.optionCountText, { color: active ? '#FFFFFF' : colors.textMuted }]}>{option.count}</Text>
                    </View>
                    <FontAwesome6 name={active ? 'circle-check' : 'circle'} size={15} color={active ? colors.primary : colors.border} solid={active} />
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </GlassBackdrop>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderWidth: 1.5, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 12 },
  currentIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  current: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, flexShrink: 1 },
  when: { ...typography.caption, fontSize: 11.5 },
  count: { minWidth: 22, height: 20, borderRadius: 10, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  countText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14 },
  buttonWrap: { borderRadius: 13, overflow: 'hidden' },
  button: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 5,
    marginTop: -4,
    marginBottom: 12,
  },
  rangeText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  rangeClear: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#64748B', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  sheet: { borderRadius: 22, overflow: 'hidden' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  sheetHeadIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15.5, color: '#FFFFFF', flex: 1 },
  sheetClose: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  options: { padding: 12, gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 10 },
  optionIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, flex: 1 },
  optionCount: { minWidth: 26, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  optionCountText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, lineHeight: 15 },
});
