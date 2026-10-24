import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SavedList } from '@/state/listStore';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

const PREVIEW_ITEMS = 4;

interface ListPickerRowProps {
  lists: SavedList[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Picking one of the saved lists in little room: one sideways row of small cards (name and
 * how many items), the chosen one filled blue, and its items in one line underneath.
 */
export function ListPickerRow({ lists, selectedId, onSelect }: ListPickerRowProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const selected = lists.find((list) => list.id === selectedId) ?? null;
  const names = (selected?.items ?? []).map((item) => item.name).filter(Boolean);
  const shown = names.slice(0, PREVIEW_ITEMS).join(', ');
  const more = names.length - PREVIEW_ITEMS;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {lists.map((list) => {
          const active = list.id === selectedId;
          const count = list.items.filter((item) => item.name.trim()).length;
          const content = (
            <>
              <FontAwesome6 name="basket-shopping" size={13} color={active ? '#FFFFFF' : colors.primary} solid />
              <View style={styles.text}>
                <Text style={[styles.name, { color: active ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
                  {list.name || t('chooseList.untitled')}
                </Text>
                <Text style={[styles.count, { color: active ? 'rgba(255,255,255,0.85)' : colors.textMuted }]}>
                  {t('chooseList.itemCount', { count })}
                </Text>
              </View>
            </>
          );
          return (
            <Pressable key={list.id} onPress={() => onSelect(list.id)} accessibilityRole="radio" accessibilityState={{ selected: active }}>
              {active ? (
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                  {content}
                </LinearGradient>
              ) : (
                <View style={[styles.card, styles.cardOff, { backgroundColor: colors.background, borderColor: colors.border }]}>{content}</View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {names.length > 0 ? (
        <Text style={[styles.preview, { color: colors.textMuted }]} numberOfLines={1}>
          {more > 0 ? `${shown} ${t('chooseList.more', { count: more })}` : shown}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { gap: 8, paddingRight: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 52, borderRadius: 14, paddingHorizontal: 12, maxWidth: 190 },
  cardOff: { borderWidth: 1 },
  text: { flexShrink: 1 },
  name: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 17 },
  count: { ...typography.caption, fontSize: 11, lineHeight: 14 },
  preview: { ...typography.caption, fontSize: 12, paddingHorizontal: 2 },
});
