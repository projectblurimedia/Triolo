import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, typography } from '@/theme';

export interface SideDockItem {
  key: string;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  label: string;
}

interface SideDockMenuProps {
  visible: boolean;
  onClose: () => void;
  accentColor: readonly [string, string] | string;
  items: SideDockItem[];
  onSelectItem: (item: SideDockItem) => void;
}

const DOCK_WIDTH = 72;

/**
 * A compact vertical icon dock — a floating rounded panel vertically centered on the
 * right edge of the screen (not tied to the header, so it reads as an independent
 * floating quick-action dock rather than a dropdown), stacked icon+label buttons with
 * thin dividers. A deliberately different, more minimal reveal than the drawer/bottom-
 * sheet/grid menus elsewhere in the app (HomeMenuModal, ProfileMenuModal, the earlier
 * GridMenuModal this replaced for Services/Bazaar). Fade + scale entrance, fixed-duration
 * timing (not spring), same rationale as every other modal-close-must-unblock-touches-
 * promptly note in this app.
 */
export function SideDockMenu({ visible, onClose, accentColor, items, onSelectItem }: SideDockMenuProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!rendered) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: visible ? 220 : 160, useNativeDriver: true }),
      Animated.timing(scale, {
        toValue: visible ? 1 : 0.9,
        duration: visible ? 220 : 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!visible && finished) {
        setRendered(false);
      }
    });
  }, [visible, rendered]);

  const backgroundColor = typeof accentColor === 'string' ? accentColor : accentColor[0];

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.dock, { backgroundColor, opacity, transform: [{ scale }] }]}>
          {items.map((item, index) => (
            <View key={item.key}>
              <Pressable
                style={styles.item}
                onPress={() => onSelectItem(item)}
                accessibilityLabel={item.label}
                hitSlop={4}
              >
                <FontAwesome6 name={item.icon} size={18} color="#FFFFFF" solid />
                <Text style={styles.itemLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
              {index < items.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 16 },
  dock: {
    width: DOCK_WIDTH,
    borderRadius: 24,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  item: { width: DOCK_WIDTH, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 5 },
  itemLabel: { ...typography.caption, fontFamily: fonts.medium, fontSize: 10, color: '#FFFFFF' },
  divider: { width: 32, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.25)', alignSelf: 'center' },
});
