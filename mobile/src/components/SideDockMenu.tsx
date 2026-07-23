import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const DOCK_WIDTH = 56;
const ITEM_SIZE = 44;

/**
 * A compact vertical icon dock — a floating rounded-rect pill anchored under the
 * header's menu button, stacked icon buttons with thin dividers, no text labels. A
 * deliberately different, more minimal reveal than the drawer/bottom-sheet/grid menus
 * elsewhere in the app (HomeMenuModal, ProfileMenuModal, the earlier GridMenuModal this
 * replaced for Services/Bazaar) — modeled after compact icon-dock side menus rather than
 * a list or grid. Fade + slight downward slide, fixed-duration timing (not spring), same
 * rationale as every other modal-close-must-unblock-touches-promptly note in this app.
 */
export function SideDockMenu({ visible, onClose, accentColor, items, onSelectItem }: SideDockMenuProps) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
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
      Animated.timing(translateY, {
        toValue: visible ? 0 : -12,
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
        <View style={[styles.anchor, { top: insets.top + 60 }]} pointerEvents="box-none">
          <Animated.View style={[styles.dock, { backgroundColor, opacity, transform: [{ translateY }] }]}>
            {items.map((item, index) => (
              <View key={item.key}>
                <Pressable
                  style={styles.item}
                  onPress={() => onSelectItem(item)}
                  accessibilityLabel={item.label}
                  hitSlop={4}
                >
                  <FontAwesome6 name={item.icon} size={17} color="#FFFFFF" solid />
                </Pressable>
                {index < items.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  anchor: { position: 'absolute', right: 16, alignItems: 'flex-end' },
  dock: {
    width: DOCK_WIDTH,
    borderRadius: DOCK_WIDTH / 2,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  item: { width: ITEM_SIZE, height: ITEM_SIZE, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 26, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.25)', alignSelf: 'center' },
});
