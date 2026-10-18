import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { useListStore } from '@/state/listStore';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

const LIST_GRADIENT = ['#DB2777', '#F472B6'] as const;
const PREVIEW_ITEMS = 3;

interface ChooseListModalProps {
  visible: boolean;
  onClose: () => void;
  /** A list was picked: send it to a nearby shop. */
  onPick: (listId: string) => void;
  /** No lists yet (or a new one wanted): go and make one (the Prepare List tab). */
  onCreate: () => void;
}

/**
 * Home's "Order from a Shop", step 1 of 2: a full screen with the app's gradient header, your
 * saved lists as cards (a peek at the items in each) to pick one, and Choose a Shop at the
 * bottom. With no lists yet, it points to Prepare List.
 */
export function ChooseListModal({ visible, onClose, onPick, onCreate }: ChooseListModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const lists = useListStore((state) => state.lists);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Each time it opens, the first (newest) list is picked to start with.
  useEffect(() => {
    if (visible) setSelectedId(lists[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const preview = (names: string[]) => {
    const shown = names.filter(Boolean).slice(0, PREVIEW_ITEMS).join(', ');
    const more = names.length - PREVIEW_ITEMS;
    return more > 0 ? `${shown} ${t('chooseList.more', { count: more })}` : shown;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.back')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t('chooseList.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('chooseList.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {lists.length === 0 ? (
          <View style={styles.emptyBody}>
            <LinearGradient colors={LIST_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIcon}>
              <FontAwesome6 name="list-check" size={30} color="#FFFFFF" solid />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('chooseList.emptyTitle')}</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('chooseList.empty')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.steps}>
              <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumber}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.text }]}>{t('chooseList.stepPick')}</Text>
              <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
              <View style={[styles.stepDot, { backgroundColor: colors.border }]}>
                <Text style={[styles.stepNumber, { color: colors.textMuted }]}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textMuted }]}>{t('chooseList.stepShop')}</Text>
            </View>

            {lists.map((list) => {
              const selected = list.id === selectedId;
              return (
                <Pressable
                  key={list.id}
                  onPress={() => setSelectedId(list.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                    selected ? styles.cardSelected : null,
                  ]}
                >
                  <LinearGradient colors={LIST_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardIcon}>
                    <FontAwesome6 name="basket-shopping" size={16} color="#FFFFFF" solid />
                  </LinearGradient>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                      {list.name || t('chooseList.untitled')}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.primary }]}>
                      {t('chooseList.itemCount', { count: list.items.length })}
                    </Text>
                    {list.items.length > 0 ? (
                      <Text style={[styles.cardPreview, { color: colors.textMuted }]} numberOfLines={2}>
                        {preview(list.items.map((item) => item.name))}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: selected ? colors.primary : colors.border },
                      selected ? { backgroundColor: colors.primary } : null,
                    ]}
                  >
                    {selected ? <FontAwesome6 name="check" size={11} color="#FFFFFF" solid /> : null}
                  </View>
                </Pressable>
              );
            })}

            <Pressable onPress={onCreate} style={[styles.newList, { borderColor: colors.border }]} accessibilityRole="button">
              <FontAwesome6 name="plus" size={13} color={colors.primary} solid />
              <Text style={[styles.newListText, { color: colors.primary }]}>{t('chooseList.newList')}</Text>
            </Pressable>
          </ScrollView>
        )}

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 16, borderTopColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          {lists.length === 0 ? (
            <Button label={t('chooseList.create')} onPress={onCreate} />
          ) : (
            <Button label={t('chooseList.next')} onPress={() => selectedId && onPick(selectedId)} disabled={!selectedId} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleGroup: { marginLeft: 14, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
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
  body: { padding: 20, paddingBottom: 32, gap: 12 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { ...typography.caption, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 11 },
  stepText: { ...typography.caption, fontFamily: fonts.medium },
  stepLine: { flex: 1, height: 2, borderRadius: 1, marginHorizontal: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 18, padding: 14 },
  cardSelected: {
    shadowColor: '#0055D3',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold },
  cardMeta: { ...typography.caption, fontFamily: fonts.medium, marginTop: 1 },
  cardPreview: { ...typography.caption, marginTop: 3, lineHeight: 16 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  newList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  newListText: { ...typography.body, fontFamily: fonts.semiBold },
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyText: { ...typography.body, textAlign: 'center', lineHeight: 21 },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
