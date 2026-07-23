import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, typography, useThemeColors } from '@/theme';

export interface GridMenuItem {
  key: string;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  label: string;
}

interface GridMenuModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  gradient: readonly [string, string];
  items: GridMenuItem[];
  onSelectItem: (item: GridMenuItem) => void;
}

/**
 * A grid of icon tiles that spin-and-scale into place with a staggered entrance — a
 * deliberately different reveal from the sliding drawer/list menus elsewhere in the app
 * (HomeMenuModal, ProfileMenuModal), modeled after playful gallery-app quick-action
 * reveals. `Easing.back` gives the settle a slight overshoot ("pop") rather than a flat
 * ease — still a fixed-duration `timing`, not a `spring` (see the drawer-animation note
 * elsewhere in the app for why fixed duration matters for a Modal that blocks touches
 * while animating). Items are static placeholders for now (see callers).
 */
export function GridMenuModal({ visible, onClose, title, gradient, items, onSelectItem }: GridMenuModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const anims = useRef(items.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      anims.forEach((anim) => anim.setValue(0));
      Animated.stagger(
        60,
        anims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }),
        ),
      ).start();
    }
  }, [visible, anims]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Pressable onPress={onClose} accessibilityLabel={t('common.close')} hitSlop={8}>
              <FontAwesome6 name="xmark" size={18} color={colors.textMuted} solid />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {items.map((item, index) => {
              const anim = anims[index];
              const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['-120deg', '0deg'] });
              return (
                <Pressable key={item.key} style={styles.tile} onPress={() => onSelectItem(item)}>
                  <Animated.View style={{ opacity: anim, transform: [{ scale: anim }, { rotate }] }}>
                    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileIcon}>
                      <FontAwesome6 name={item.icon} size={20} color="#FFFFFF" solid />
                    </LinearGradient>
                  </Animated.View>
                  <Text style={[styles.tileLabel, { color: colors.text }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48%', alignItems: 'center', marginBottom: 18 },
  tileIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { ...typography.caption, fontFamily: fonts.medium, marginTop: 8, textAlign: 'center' },
});
