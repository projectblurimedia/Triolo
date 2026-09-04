import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, typography } from '@/theme';

export interface SideDockItem {
  key: string;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  label: string;
}

interface SideDockMenuProps {
  visible: boolean;
  onClose: () => void;
  /** The same two-stop gradient the header itself uses (headerGradient / SHOP_GRADIENT) — the dock's background matches its header instead of a flat fill. */
  gradient: readonly [string, string];
  items: SideDockItem[];
  onSelectItem: (item: SideDockItem) => void;
}

const DOCK_WIDTH = 72;
// Same value used for the dock's own right-edge gap (styles.anchor's `right`) — the gap
// below the header matches the gap from the screen edge, a deliberate, consistent margin
// on both sides rather than two independently-chosen numbers.
const DOCK_GAP = 16;
// Approximates GradientHeader's own rendered height (insets.top is added separately) —
// paddingTop 14 + icon/title row ~40 + content paddingBottom 16 + accent bar 3.
const HEADER_CONTENT_HEIGHT = 73;

/**
 * A compact vertical icon dock — a floating rounded panel anchored just below the header
 * on the right edge (the gap from the header matches the gap from the screen edge),
 * stacked icon+label buttons with thin dividers, background gradient matching the
 * header's own. A deliberately different, more minimal reveal than the drawer/bottom-
 * sheet/grid menus elsewhere in the app (HomeMenuModal, ProfileMenuModal, the earlier
 * GridMenuModal this replaced for Services/Bazaar). Fade + slide-down entrance,
 * fixed-duration timing (not spring), same rationale as every other modal-close-must-
 * unblock-touches-promptly note in this app.
 */
export function SideDockMenu({ visible, onClose, gradient, items, onSelectItem }: SideDockMenuProps) {
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

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.anchor, { top: insets.top + HEADER_CONTENT_HEIGHT + DOCK_GAP }]} pointerEvents="box-none">
          <Animated.View style={[styles.dockWrap, { opacity, transform: [{ translateY }] }]}>
            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dock}>
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
            </LinearGradient>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  anchor: { position: 'absolute', right: DOCK_GAP, alignItems: 'flex-end' },
  dockWrap: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  dock: { width: DOCK_WIDTH, borderRadius: 24, paddingVertical: 10, alignItems: 'center' },
  item: { width: DOCK_WIDTH, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 5 },
  itemLabel: { ...typography.caption, fontFamily: fonts.medium, fontSize: 10, color: '#FFFFFF' },
  divider: { width: 32, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.25)', alignSelf: 'center' },
});
