import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SavedList } from '@/state/listStore';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { ListPhotoStrip } from './ListPhotoStrip';
import { VoiceMessage } from './VoiceMessage';
import { listCountText } from '@/utils/listPhotos';
import { FullText } from '@/components/FullText';

// Past this many items the box scrolls instead of growing.
const ITEMS_BEFORE_SCROLL = 6;

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
  const items = (selected?.items ?? []).filter((item) => item.name.trim());

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {lists.map((list) => {
          const active = list.id === selectedId;
          const count = list.items.filter((item) => item.name.trim()).length;
          const photoCount = (list.photos ?? []).length;
          const content = (
            <>
              <FontAwesome6 name="basket-shopping" size={13} color={active ? '#FFFFFF' : colors.primary} solid />
              <View style={styles.text}>
                <FullText style={[styles.name, { color: active ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
                  {list.name || t('chooseList.untitled')}
                </FullText>
                <Text style={[styles.count, { color: active ? 'rgba(255,255,255,0.85)' : colors.textMuted }]}>
                  {listCountText(t, count, photoCount, list.voice?.seconds ?? null)}
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
      {selected?.voice ? <VoiceMessage uri={selected.voice.uri} seconds={selected.voice.seconds} /> : null}
      <ListPhotoStrip photos={(selected?.photos ?? []).map((photo) => photo.uri)} size={56} />
      {/* Every item of the chosen list, for reference while ordering. */}
      {items.length > 0 ? (
        <View style={[styles.itemsBox, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}26` }]}>
          <Text style={[styles.itemsTitle, { color: colors.textMuted }]}>{t('chooseList.itemsInList', { count: items.length })}</Text>
          <ScrollView style={styles.itemsScroll} nestedScrollEnabled showsVerticalScrollIndicator={items.length > ITEMS_BEFORE_SCROLL}>
            {items.map((item, index) => (
              <View key={item.id} style={[styles.itemRow, index > 0 ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                <Text style={[styles.itemIndex, { color: colors.primary }]}>{index + 1}.</Text>
                <FullText style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </FullText>
                {item.quantity || item.unit ? (
                  <Text style={[styles.itemQty, { color: colors.textMuted }]}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
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
  itemsBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  itemsTitle: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.4, marginBottom: 4 },
  itemsScroll: { maxHeight: 6 * 34 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  itemIndex: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, width: 22 },
  itemName: { ...typography.body, fontSize: 14, flex: 1 },
  itemQty: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
});
