import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { GlassBackdrop, GlassCard } from './Glass';
import { useListStore } from '@/state/listStore';
import { fonts, typography, useThemeColors } from '@/theme';

const LIST_GRADIENT = ['#DB2777', '#F472B6'] as const;

interface ChooseListModalProps {
  visible: boolean;
  onClose: () => void;
  /** A list was picked: send it to a nearby shop. */
  onPick: (listId: string) => void;
  /** No lists yet: go and make one (the Prepare List tab). */
  onCreate: () => void;
}

/** Home's "Order from a Shop": pick one of your saved lists, then choose a nearby shop for it. */
export function ChooseListModal({ visible, onClose, onPick, onCreate }: ChooseListModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const lists = useListStore((state) => state.lists);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GlassBackdrop onPress={onClose} style={styles.center}>
        <GlassCard style={styles.card}>
          <View style={styles.head}>
            <LinearGradient colors={LIST_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headIcon}>
              <FontAwesome6 name="basket-shopping" size={16} color="#FFFFFF" solid />
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{t('chooseList.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('chooseList.subtitle')}</Text>
            </View>
          </View>

          {lists.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('chooseList.empty')}</Text>
              <Button label={t('chooseList.create')} onPress={onCreate} gradient={LIST_GRADIENT} />
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {lists.map((list) => (
                <Pressable
                  key={list.id}
                  onPress={() => onPick(list.id)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: `${LIST_GRADIENT[0]}1A` }]}>
                    <FontAwesome6 name="list-check" size={14} color={LIST_GRADIENT[0]} solid />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {list.name || t('chooseList.untitled')}
                    </Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {t('chooseList.itemCount', { count: list.items.length })}
                    </Text>
                  </View>
                  <FontAwesome6 name="chevron-right" size={13} color={colors.textMuted} solid />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </GlassCard>
      </GlassBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', paddingHorizontal: 22 },
  card: { borderRadius: 22, padding: 18 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  subtitle: { ...typography.caption, marginTop: 1 },
  list: { maxHeight: 360 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...typography.body, fontFamily: fonts.semiBold },
  rowMeta: { ...typography.caption, marginTop: 1 },
  empty: { gap: 14 },
  emptyText: { ...typography.body, textAlign: 'center', lineHeight: 21 },
});
