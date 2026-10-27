import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { GlassBackdrop, GlassCard } from './Glass';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

/** A from – to range of whole days; null ends are open ("since", "until", or all time). */
export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export const ALL_TIME: DateRange = { from: null, to: null };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_MS = 24 * 3600 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Built by hand — Hermes on Android doesn't reliably ship Intl date formatting.
export function formatDay(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Whether an ISO time falls inside the range (both ends inclusive, whole days). */
export function inRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!iso) return false;
  const at = new Date(iso).getTime();
  if (range.from && at < startOfDay(range.from).getTime()) return false;
  if (range.to && at >= startOfDay(range.to).getTime() + DAY_MS) return false;
  return true;
}

/** "1 Oct – 24 Oct", "Since 1 Oct", or null for all time. */
export function rangeLabel(range: DateRange, t: TFunction): string | null {
  if (range.from && range.to) return sameDay(range.from, range.to) ? formatDay(range.from) : `${formatDay(range.from)} – ${formatDay(range.to)}`;
  if (range.from) return t('dateRange.since', { date: formatDay(range.from) });
  if (range.to) return t('dateRange.until', { date: formatDay(range.to) });
  return null;
}

const sameRange = (a: DateRange, b: DateRange) =>
  (a.from?.getTime() ?? 0) === (b.from?.getTime() ?? 0) && (a.to?.getTime() ?? 0) === (b.to?.getTime() ?? 0);

/**
 * Picking a date range, made plain: quick choices on top (All time, Today, Last 7 / 30 days,
 * This month), then two boxes — From and To — and a calendar. Tap a box to say which date you
 * are picking (the active one is highlighted), then tap a day; the days in between are shaded.
 */
export function DateRangeSheet({
  visible,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: DateRange;
  onClose: () => void;
  onApply: (range: DateRange) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const today = startOfDay(new Date());
  const [draft, setDraft] = useState<DateRange>(value);
  const [picking, setPicking] = useState<'from' | 'to'>('from');
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setPicking(value.from && !value.to ? 'to' : 'from');
    const shown = value.to ?? value.from ?? today;
    setMonth(new Date(shown.getFullYear(), shown.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const presets: { key: string; icon: React.ComponentProps<typeof FontAwesome6>['name']; range: DateRange }[] = [
    { key: 'all', icon: 'infinity', range: ALL_TIME },
    { key: 'today', icon: 'sun', range: { from: today, to: today } },
    { key: 'week', icon: 'calendar-week', range: { from: new Date(today.getTime() - 6 * DAY_MS), to: today } },
    { key: 'month30', icon: 'calendar-days', range: { from: new Date(today.getTime() - 29 * DAY_MS), to: today } },
    { key: 'thisMonth', icon: 'calendar', range: { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today } },
  ];

  const pick = (day: Date) => {
    if (picking === 'from') {
      setDraft({ from: day, to: draft.to && draft.to >= day ? draft.to : null });
      setPicking('to');
    } else if (draft.from && day < draft.from) {
      // An end before the start: it becomes the new start.
      setDraft({ from: day, to: null });
    } else {
      setDraft({ from: draft.from, to: day });
    }
  };

  // The month's days, padded to whole weeks.
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const atLatest = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const label = rangeLabel(draft, t);

  const box = (which: 'from' | 'to') => {
    const date = which === 'from' ? draft.from : draft.to;
    const active = picking === which;
    return (
      <Pressable
        onPress={() => setPicking(which)}
        style={[
          styles.box,
          { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}12` : colors.background },
        ]}
      >
        <Text style={[styles.boxLabel, { color: active ? colors.primary : colors.textMuted }]}>
          {t(which === 'from' ? 'dateRange.from' : 'dateRange.to')}
        </Text>
        <Text style={[styles.boxValue, { color: date ? colors.text : colors.textMuted }]} numberOfLines={1}>
          {date ? `${formatDay(date)} ${date.getFullYear()}` : t('dateRange.anyDay')}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GlassBackdrop onPress={onClose} style={styles.overlay}>
        <GlassCard style={styles.sheet}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
            <View style={styles.headIcon}>
              <FontAwesome6 name="calendar-days" size={15} color="#FFFFFF" solid />
            </View>
            <View style={styles.flex}>
              <Text style={styles.headTitle}>{t('dateRange.title')}</Text>
              <Text style={styles.headText} numberOfLines={1}>
                {label ?? t('dateRange.all')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close} accessibilityLabel={t('common.close')}>
              <FontAwesome6 name="xmark" size={14} color="#FFFFFF" solid />
            </Pressable>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={[styles.section, { color: colors.textMuted }]}>{t('dateRange.quick')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
              {presets.map((preset) => {
                const chosen = sameRange(draft, preset.range);
                const inner = (
                  <>
                    <FontAwesome6 name={preset.icon} size={11} color={chosen ? '#FFFFFF' : colors.primary} solid />
                    <Text style={[styles.presetText, { color: chosen ? '#FFFFFF' : colors.primary }]}>{t(`dateRange.${preset.key}`)}</Text>
                  </>
                );
                return (
                  <Pressable key={preset.key} onPress={() => setDraft(preset.range)}>
                    {chosen ? (
                      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.preset}>
                        {inner}
                      </LinearGradient>
                    ) : (
                      <View style={[styles.preset, { borderWidth: 1, borderColor: `${colors.primary}40`, backgroundColor: colors.surface }]}>{inner}</View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.section, { color: colors.textMuted }]}>{t('dateRange.custom')}</Text>
            <View style={styles.boxes}>
              {box('from')}
              <FontAwesome6 name="arrow-right" size={12} color={colors.textMuted} solid />
              {box('to')}
            </View>
            <Text style={[styles.hint, { color: colors.primary }]}>
              {t(picking === 'from' ? 'dateRange.pickStart' : 'dateRange.pickEndDay')}
            </Text>

            <View style={[styles.calendar, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <View style={styles.monthRow}>
                <Pressable
                  onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  hitSlop={8}
                  style={[styles.arrow, { backgroundColor: `${colors.primary}14` }]}
                >
                  <FontAwesome6 name="chevron-left" size={12} color={colors.primary} solid />
                </Pressable>
                <Text style={[styles.monthText, { color: colors.text }]}>
                  {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
                </Text>
                <Pressable
                  onPress={() => !atLatest && setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  disabled={atLatest}
                  hitSlop={8}
                  style={[styles.arrow, { backgroundColor: `${colors.primary}14`, opacity: atLatest ? 0.3 : 1 }]}
                >
                  <FontAwesome6 name="chevron-right" size={12} color={colors.primary} solid />
                </Pressable>
              </View>
              <View style={styles.week}>
                {DAYS.map((day, index) => (
                  <Text key={index} style={[styles.weekDay, { color: colors.textMuted }]}>
                    {day}
                  </Text>
                ))}
              </View>
              <View style={styles.grid}>
                {cells.map((day, index) => {
                  if (!day) return <View key={index} style={styles.cell} />;
                  const future = day > today;
                  const isFrom = !!draft.from && sameDay(day, draft.from);
                  const isTo = !!draft.to && sameDay(day, draft.to);
                  const both = !!draft.from && !!draft.to && !sameDay(draft.from, draft.to);
                  const between = !!draft.from && !!draft.to && day > draft.from && day < draft.to;
                  const band = `${colors.primary}1F`;
                  return (
                    <Pressable key={index} disabled={future} onPress={() => pick(day)} style={styles.cell}>
                      {/* The shaded band joining From to To. */}
                      {between ? <View style={[styles.band, { backgroundColor: band }]} /> : null}
                      {both && isFrom ? <View style={[styles.band, styles.bandRight, { backgroundColor: band }]} /> : null}
                      {both && isTo ? <View style={[styles.band, styles.bandLeft, { backgroundColor: band }]} /> : null}
                      <View
                        style={[
                          styles.day,
                          isFrom || isTo ? { backgroundColor: colors.primary } : null,
                          sameDay(day, today) && !isFrom && !isTo ? { borderWidth: 1.5, borderColor: colors.primary } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: isFrom || isTo ? '#FFFFFF' : future ? colors.border : colors.text },
                            isFrom || isTo ? styles.dayTextChosen : null,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable onPress={() => setDraft(ALL_TIME)} style={[styles.cancel, { borderColor: colors.border }]}>
                <FontAwesome6 name="rotate-left" size={12} color={colors.textMuted} solid />
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>{t('dateRange.reset')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onApply(draft);
                  onClose();
                }}
                style={styles.applyWrap}
              >
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.apply}>
                  <FontAwesome6 name="check" size={13} color="#FFFFFF" solid />
                  <Text style={styles.applyText} numberOfLines={1}>
                    {label ? t('dateRange.showRange', { range: label }) : t('dateRange.showAll')}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </GlassCard>
      </GlassBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { borderRadius: 22, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  headIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  headTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15.5, color: '#FFFFFF' },
  headText: { ...typography.caption, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 14, gap: 8 },
  section: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  presets: { gap: 7, paddingBottom: 4 },
  preset: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingHorizontal: 13 },
  presetText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5, lineHeight: 16 },
  boxes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { flex: 1, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8 },
  boxLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4 },
  boxValue: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 19 },
  hint: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, textAlign: 'center' },
  calendar: { borderRadius: 16, borderWidth: 1, padding: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  arrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  monthText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14.5 },
  week: { flexDirection: 'row', marginBottom: 2 },
  weekDay: { flex: 1, textAlign: 'center', ...typography.caption, fontSize: 11, fontFamily: fonts.semiBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 38, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', left: 0, right: 0, top: 3, bottom: 3 },
  bandLeft: { right: '50%' },
  bandRight: { left: '50%' },
  day: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayText: { ...typography.caption, fontSize: 13, fontFamily: fonts.medium },
  dayTextChosen: { fontFamily: fonts.semiBold },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14 },
  cancelText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5 },
  applyWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  apply: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, paddingHorizontal: 12 },
  applyText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, color: '#FFFFFF', flexShrink: 1 },
});
