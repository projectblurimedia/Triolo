import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { LoadingIndicator } from './LoadingIndicator';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

export interface PickerOption {
  key: string;
  label: string;
  icon?: IconName | string;
}

interface CategoryPickerProps {
  /** Header of the picker screen, e.g. "Choose services". */
  title: string;
  /** What the closed field says before anything is picked. */
  placeholder: string;
  options: PickerOption[];
  /** Picked keys; a partner-made category is its own name. */
  selected: string[];
  onChange: (next: string[]) => void;
  /** One choice only: picking closes the picker. */
  single?: boolean;
  /** Partner-made categories matching the search (shown only while searching). */
  searchCustom?: (query: string) => Promise<string[]>;
  /** Lets a new category be added from the search text. */
  allowAdd?: boolean;
  /** Picked items as cards below the field (default on). */
  showCards?: boolean;
  /** Icon for partner-made / added categories. */
  customIcon?: IconName;
  /** A filter (single): an "All" row on top that clears the choice, shown by the field when nothing is picked. */
  allLabel?: string;
  /** How many results each option has (shown on its row), e.g. workers nearby. */
  counts?: Record<string, number>;
  /** The closed field's icon. */
  fieldIcon?: IconName;
  /** A ✕ on the field clears the choice (a filter with an "All" label always has it). */
  clearable?: boolean;
  style?: StyleProp<ViewStyle>;
}

type Row =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'all'; key: string }
  | { kind: 'option'; key: string; option: PickerOption; custom?: boolean }
  | { kind: 'add'; key: string; text: string }
  | { kind: 'loading'; key: string };

const SEARCH_DEBOUNCE_MS = 250;
const byLabel = (a: PickerOption, b: PickerOption) => a.label.localeCompare(b.label);

/**
 * (Copied in partner-app — keep in sync.)
 * A searchable dropdown for categories: tap the field and a screen opens with a search box and
 * the whole list A–Z, the picked ones on top. Pick as many as needed (or one, with `single`);
 * Done closes it and the picks show as cards under the field. While searching it also offers
 * matching categories partners made themselves, and (with `allowAdd`) adding a new one.
 */
export function CategoryPicker({
  title,
  placeholder,
  options,
  selected,
  onChange,
  single,
  searchCustom,
  allowAdd,
  showCards = true,
  customIcon = 'tag',
  allLabel,
  counts,
  fieldIcon = 'magnifying-glass',
  clearable,
  style,
}: CategoryPickerProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string[]>(selected);
  const [custom, setCustom] = useState<string[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const searchId = useRef(0);

  const byKey = useMemo(() => new Map(options.map((option) => [option.key, option])), [options]);
  const optionFor = (key: string): PickerOption => byKey.get(key) ?? { key, label: key, icon: customIcon };

  useEffect(() => {
    if (open) {
      setDraft(selected);
      setQuery('');
      setCustom([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Partner-made categories that match what's typed.
  useEffect(() => {
    const text = query.trim();
    if (!open || !searchCustom || text.length < 2) {
      setCustom([]);
      setLoadingCustom(false);
      return;
    }
    const id = ++searchId.current;
    setLoadingCustom(true);
    const timer = setTimeout(() => {
      searchCustom(text)
        .then((names) => id === searchId.current && setCustom(names))
        .catch(() => id === searchId.current && setCustom([]))
        .finally(() => id === searchId.current && setLoadingCustom(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open, searchCustom]);

  const toggle = (key: string) => {
    if (single) {
      onChange([key]);
      setOpen(false);
      return;
    }
    setDraft((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  };

  const finish = () => {
    onChange(draft);
    setOpen(false);
  };

  const rows = useMemo<Row[]>(() => {
    const text = query.trim().toLowerCase();
    const sorted = [...options].sort(byLabel);
    const picked = (single ? selected : draft).map(optionFor);
    const list: Row[] = [];
    if (allLabel && single && !text) list.push({ kind: 'all', key: 'all' });
    if (!text) {
      if (picked.length > 0 && !single) {
        list.push({ kind: 'header', key: 'h-picked', title: t('picker.selected', { count: picked.length }) });
        picked.forEach((option) => list.push({ kind: 'option', key: `p-${option.key}`, option, custom: !byKey.has(option.key) }));
        list.push({ kind: 'header', key: 'h-all', title: t('picker.all') });
      }
      sorted
        .filter((option) => single || !picked.some((entry) => entry.key === option.key))
        .forEach((option) => list.push({ kind: 'option', key: option.key, option }));
      return list;
    }
    const matches = sorted.filter((option) => option.label.toLowerCase().includes(text));
    // Picked ones first, even while searching.
    const ordered = [
      ...matches.filter((option) => draft.includes(option.key)),
      ...matches.filter((option) => !draft.includes(option.key)),
    ];
    ordered.forEach((option) => list.push({ kind: 'option', key: option.key, option }));
    const known = new Set([...options.map((option) => option.label.toLowerCase()), ...draft.map((key) => optionFor(key).label.toLowerCase())]);
    const partnerMade = custom.filter((name) => !known.has(name.toLowerCase()));
    const pickedCustom = draft.filter((key) => !byKey.has(key) && key.toLowerCase().includes(text));
    if (partnerMade.length > 0 || pickedCustom.length > 0 || loadingCustom) {
      list.push({ kind: 'header', key: 'h-custom', title: t('picker.addedByPartners') });
      pickedCustom.forEach((name) => list.push({ kind: 'option', key: `c-${name}`, option: optionFor(name), custom: true }));
      partnerMade.forEach((name) => list.push({ kind: 'option', key: `c-${name}`, option: { key: name, label: name, icon: customIcon }, custom: true }));
      if (loadingCustom && partnerMade.length === 0) list.push({ kind: 'loading', key: 'loading' });
    }
    const typed = query.trim();
    const exact = known.has(typed.toLowerCase()) || custom.some((name) => name.toLowerCase() === typed.toLowerCase());
    if (allowAdd && typed.length >= 2 && !exact) list.push({ kind: 'add', key: 'add', text: typed });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, options, draft, selected, custom, loadingCustom, single, allowAdd]);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'header') {
      return <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>{item.title}</Text>;
    }
    if (item.kind === 'all') {
      const isAll = selected.length === 0;
      return (
        <Pressable
          onPress={() => {
            onChange([]);
            setOpen(false);
          }}
          accessibilityRole="radio"
          accessibilityState={{ checked: isAll }}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: isAll ? `${colors.primary}10` : colors.surface,
              borderColor: isAll ? colors.primary : colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={[styles.rowIcon, { backgroundColor: `${colors.primary}14` }]}>
            <FontAwesome6 name="border-all" size={14} color={colors.primary} solid />
          </View>
          <Text style={[styles.rowLabel, styles.flex, { color: colors.text }]}>{allLabel}</Text>
          <View style={[styles.radio, { borderColor: isAll ? colors.primary : colors.border, backgroundColor: isAll ? colors.primary : 'transparent' }]}>
            {isAll ? <FontAwesome6 name="check" size={11} color="#FFFFFF" solid /> : null}
          </View>
        </Pressable>
      );
    }
    if (item.kind === 'loading') {
      return (
        <View style={styles.loadingRow}>
          <LoadingIndicator size={20} color={colors.primary} />
        </View>
      );
    }
    if (item.kind === 'add') {
      return (
        <Pressable
          onPress={() => {
            const name = item.text.replace(/[.:]/g, '').trim();
            if (!name) return;
            if (single) {
              onChange([name]);
              setOpen(false);
            } else {
              setDraft((current) => (current.includes(name) ? current : [...current, name]));
              setQuery('');
            }
          }}
          style={({ pressed }) => [styles.row, styles.addRow, { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.primary }]}>
            <FontAwesome6 name="plus" size={13} color="#FFFFFF" solid />
          </View>
          <Text style={[styles.rowLabel, { color: colors.primary }]} numberOfLines={2}>
            {t('picker.add', { name: item.text })}
          </Text>
        </Pressable>
      );
    }
    const { option } = item;
    const isPicked = single ? selected.includes(option.key) : draft.includes(option.key);
    return (
      <Pressable
        onPress={() => toggle(option.key)}
        accessibilityRole={single ? 'radio' : 'checkbox'}
        accessibilityState={{ checked: isPicked }}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: isPicked ? `${colors.primary}10` : colors.surface,
            borderColor: isPicked ? colors.primary : colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.rowIcon, { backgroundColor: `${colors.primary}14` }]}>
          <FontAwesome6 name={(option.icon ?? customIcon) as IconName} size={14} color={colors.primary} solid />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={2}>
            {option.label}
          </Text>
          {item.custom ? <Text style={[styles.rowHint, { color: colors.textMuted }]}>{t('picker.partnerMade')}</Text> : null}
        </View>
        {counts ? (
          <Text style={[styles.rowCount, { color: (counts[option.key] ?? 0) > 0 ? colors.primary : colors.textMuted }]}>
            {counts[option.key] ?? 0}
          </Text>
        ) : null}
        <View
          style={[
            single ? styles.radio : styles.checkbox,
            { borderColor: isPicked ? colors.primary : colors.border, backgroundColor: isPicked ? colors.primary : 'transparent' },
          ]}
        >
          {isPicked ? <FontAwesome6 name="check" size={11} color="#FFFFFF" solid /> : null}
        </View>
      </Pressable>
    );
  };

  const pickedOptions = selected.map(optionFor);
  const summary =
    pickedOptions.length === 0
      ? (allLabel ?? placeholder)
      : single || pickedOptions.length === 1
        ? pickedOptions[0].label
        : t('picker.countSelected', { count: pickedOptions.length });

  return (
    <View style={style}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: colors.surface, borderColor: pickedOptions.length ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <FontAwesome6 name={pickedOptions.length && single ? ((pickedOptions[0].icon ?? fieldIcon) as IconName) : fieldIcon} size={14} color={colors.primary} solid />
        <Text
          style={[styles.fieldText, { color: pickedOptions.length || allLabel ? colors.text : colors.textMuted }]}
          numberOfLines={1}
        >
          {summary}
        </Text>
        {(allLabel || clearable) && pickedOptions.length > 0 ? (
          <Pressable onPress={() => onChange([])} hitSlop={10} accessibilityLabel={t('picker.clear')}>
            <FontAwesome6 name="circle-xmark" size={16} color={colors.textMuted} solid />
          </Pressable>
        ) : (
          <FontAwesome6 name="chevron-down" size={13} color={colors.textMuted} solid />
        )}
      </Pressable>

      {showCards && !single && pickedOptions.length > 0 ? (
        <View style={styles.cards}>
          {pickedOptions.map((option) => (
            <View key={option.key} style={[styles.card, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}40` }]}>
              <FontAwesome6 name={(option.icon ?? customIcon) as IconName} size={12} color={colors.primary} solid />
              <Text style={[styles.cardText, { color: colors.text }]} numberOfLines={1}>
                {option.label}
              </Text>
              <Pressable
                onPress={() => onChange(selected.filter((key) => key !== option.key))}
                hitSlop={8}
                accessibilityLabel={t('picker.remove', { name: option.label })}
              >
                <FontAwesome6 name="xmark" size={12} color={colors.textMuted} solid />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => (single ? setOpen(false) : finish())} statusBarTranslucent>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 14 }]}>
            <View style={styles.headerRow}>
              <Pressable
                style={styles.backButton}
                onPress={() => (single ? setOpen(false) : finish())}
                accessibilityLabel={t('common.back')}
                hitSlop={8}
              >
                <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {single ? t('picker.pickOne') : t('picker.pickMany')}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FontAwesome6 name="magnifying-glass" size={14} color={colors.primary} solid />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
              placeholder={t('picker.search')}
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('common.close')}>
                <FontAwesome6 name="circle-xmark" size={15} color={colors.textMuted} solid />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={renderRow}
            contentContainerStyle={[styles.list, { paddingBottom: single ? insets.bottom + 24 : 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>{t('picker.noMatch')}</Text>}
          />

          {single ? null : (
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
              <Button label={draft.length > 0 ? t('picker.doneCount', { count: draft.length }) : t('common.done')} onPress={finish} />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { height: 50, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  fieldText: { ...typography.body, flex: 1, includeFontPadding: false },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 11,
    paddingRight: 10,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  cardText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, flexShrink: 1 },
  container: { flex: 1 },
  header: { paddingBottom: 18, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { ...typography.body, flex: 1, paddingVertical: 0, includeFontPadding: false },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  sectionHeader: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  addRow: { borderStyle: 'dashed', borderWidth: 1.5 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...typography.body, fontFamily: fonts.medium },
  rowHint: { ...typography.caption, fontSize: 11, marginTop: 1 },
  rowCount: { ...typography.caption, fontFamily: fonts.semiBold, minWidth: 18, textAlign: 'right' },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  loadingRow: { alignItems: 'center', paddingVertical: 10 },
  empty: { ...typography.body, textAlign: 'center', marginTop: 30 },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
