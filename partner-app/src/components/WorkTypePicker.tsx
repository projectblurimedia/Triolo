import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { JOB_CATEGORIES, JobCategory } from '@/services/jobSeekerService';

/** The chosen kind of work: a listed category, or `other` with the person's own words. */
export interface WorkType {
  category: JobCategory;
  custom: string;
}

interface WorkTypePickerProps {
  value: WorkType | null;
  onChange: (value: WorkType) => void;
}

// "Other" is offered through "Add new" instead of as a list row.
const LISTED = JOB_CATEGORIES.filter((entry) => entry.key !== 'other');

export function workTypeLabel(value: WorkType, t: (key: string) => string): string {
  return value.category === 'other' ? value.custom : t(`jobPost.categories.${value.category}`);
}

/**
 * "What work do you do?" as a dropdown: a field showing the choice that opens a searchable list
 * of kinds of work with icons. If the work isn't listed, typing it offers "Add … as my work",
 * saved as the `other` category with those words.
 */
export function WorkTypePicker({ value, onChange }: WorkTypePickerProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const typed = search.trim();
  const options = useMemo(
    () => LISTED.filter((entry) => t(`jobPost.categories.${entry.key}`).toLowerCase().includes(typed.toLowerCase())),
    [typed, t],
  );
  const exactMatch = LISTED.some((entry) => t(`jobPost.categories.${entry.key}`).toLowerCase() === typed.toLowerCase());

  const close = () => {
    setOpen(false);
    setSearch('');
  };
  const pick = (next: WorkType) => {
    onChange(next);
    close();
  };

  const icon = value
    ? value.category === 'other'
      ? 'star'
      : (JOB_CATEGORIES.find((e) => e.key === value.category)?.icon ?? 'star')
    : null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{t('jobPost.categoryLabel')}</Text>
      <Pressable
        style={[styles.field, { borderColor: colors.border, backgroundColor: colors.surface }]}
        onPress={() => setOpen(true)}
      >
        {icon ? (
          <View style={[styles.fieldIcon, { backgroundColor: `${colors.primary}14` }]}>
            <FontAwesome6 name={icon as never} size={13} color={colors.primary} solid />
          </View>
        ) : null}
        <Text style={[styles.fieldText, { color: value ? colors.text : colors.textMuted }]} numberOfLines={1}>
          {value ? workTypeLabel(value, t) : t('jobPost.categoryPlaceholder')}
        </Text>
        <FontAwesome6 name="chevron-down" size={13} color={colors.textMuted} solid />
      </Pressable>

      <Modal visible={open} animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 14 }]}
          >
            <Pressable style={styles.backButton} onPress={close} accessibilityLabel={t('common.close')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.headerTitle}>{t('jobPost.categoryLabel')}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('jobPost.categoryPickerSubtitle')}
              </Text>
            </View>
          </LinearGradient>

          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FontAwesome6 name="magnifying-glass" size={14} color={colors.textMuted} solid />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder={t('jobPost.categorySearch')}
              placeholderTextColor={colors.textMuted}
              maxLength={40}
              autoFocus
            />
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            ListHeaderComponent={
              typed && !exactMatch ? (
                <Pressable
                  style={[styles.addRow, { borderColor: colors.primary, backgroundColor: `${colors.primary}10` }]}
                  onPress={() => pick({ category: 'other', custom: typed })}
                >
                  <View style={[styles.addBadge, { backgroundColor: colors.primary }]}>
                    <FontAwesome6 name="plus" size={12} color="#FFFFFF" solid />
                  </View>
                  <Text style={[styles.addText, { color: colors.primary }]} numberOfLines={2}>
                    {t('jobPost.addCustomWork', { work: typed })}
                  </Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              const active = value?.category === item.key;
              return (
                <Pressable
                  style={[
                    styles.option,
                    {
                      backgroundColor: colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                      borderWidth: active ? 1.5 : 1,
                    },
                  ]}
                  onPress={() => pick({ category: item.key, custom: '' })}
                >
                  <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.optionIcon}>
                    <FontAwesome6 name={item.icon as never} size={15} color="#FFFFFF" solid />
                  </LinearGradient>
                  <Text style={[styles.optionText, { color: colors.text }]}>{t(`jobPost.categories.${item.key}`)}</Text>
                  {active ? <FontAwesome6 name="circle-check" size={16} color={colors.primary} solid /> : null}
                </Pressable>
              );
            }}
            ListFooterComponent={
              typed ? null : <Text style={[styles.hint, { color: colors.textMuted }]}>{t('jobPost.categoryNotListed')}</Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { marginBottom: 16 },
  label: { ...typography.caption, marginBottom: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  fieldIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fieldText: { ...typography.body, flex: 1 },
  modal: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    margin: 16,
    marginBottom: 6,
  },
  searchInput: { flex: 1, ...typography.body, fontSize: 14, padding: 0 },
  list: { padding: 16, gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12 },
  optionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionText: { ...typography.body, fontFamily: fonts.medium, flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1.5, padding: 12 },
  addBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  addText: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  hint: { ...typography.caption, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
