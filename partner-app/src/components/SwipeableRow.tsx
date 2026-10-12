import React, { PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { colors as brandColors, fonts, typography } from '@/theme';

// Narrower than the original full-height panel (92), per feedback.
const ACTION_WIDTH = 72;
const OPEN_THRESHOLD = ACTION_WIDTH / 2;

interface SwipeableRowProps {
  /** Controlled — the parent keeps at most one row open at a time. */
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  /**
   * True from the moment the row starts sliding (or opens) until its close animation has
   * fully finished — lets the row square its right corners exactly while the panel shows.
   */
  onRevealChange?: (revealed: boolean) => void;
  deleteLabel: string;
  /** Off while the list is in selection mode. */
  enabled?: boolean;
  borderRadius?: number;
}

/**
 * Swipe left to reveal a narrow red delete panel attached to the row's right edge (square
 * left edge, right corners matching the row) — built on React Native's own
 * PanResponder (no gesture library is in either app's native build, so this ships OTA).
 * It only claims clearly horizontal drags, so vertical list scrolling and the row's own
 * tap / long-press still work normally.
 */
export function SwipeableRow({
  isOpen,
  onOpen,
  onClose,
  onDelete,
  onRevealChange,
  deleteLabel,
  enabled = true,
  borderRadius = 16,
  children,
}: PropsWithChildren<SwipeableRowProps>) {
  const translateX = useRef(new Animated.Value(0)).current;
  // Latest props for the PanResponder, which is created once.
  const latest = useRef({ isOpen, onOpen, onClose, enabled, onRevealChange });
  latest.current = { isOpen, onOpen, onClose, enabled, onRevealChange };
  const revealed = useRef(false);
  const setRevealed = (value: boolean) => {
    if (revealed.current === value) return;
    revealed.current = value;
    latest.current.onRevealChange?.(value);
  };
  const dragStart = useRef(0);

  const animateTo = (open: boolean) => {
    if (open) setRevealed(true);
    Animated.spring(translateX, {
      toValue: open ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start(({ finished }) => {
      // Only once it has fully slid back does the row get its rounded corners again.
      if (finished && !open) setRevealed(false);
    });
  };

  useEffect(() => {
    animateTo(isOpen && enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, enabled]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          latest.current.enabled && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderGrant: () => {
          dragStart.current = latest.current.isOpen ? -ACTION_WIDTH : 0;
          setRevealed(true);
        },
        onPanResponderMove: (_, gesture) => {
          // A little rubber-band past the action width, never past the closed position.
          const next = Math.min(0, Math.max(-ACTION_WIDTH * 1.35, dragStart.current + gesture.dx));
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const position = dragStart.current + gesture.dx;
          const shouldOpen = position < -OPEN_THRESHOLD || gesture.vx < -0.5;
          animateTo(shouldOpen);
          if (shouldOpen) latest.current.onOpen();
          else latest.current.onClose();
        },
        onPanResponderTerminate: () => animateTo(latest.current.isOpen),
        // Once a horizontal swipe has started, don't hand it back to the list's scroll.
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View style={[styles.container, { borderRadius }]}>
      <View style={[styles.actionArea, { borderTopRightRadius: borderRadius, borderBottomRightRadius: borderRadius }]}>
        <Pressable style={styles.deleteButton} onPress={onDelete} accessibilityRole="button" accessibilityLabel={deleteLabel}>
          <FontAwesome6 name="trash" size={16} color="#FFFFFF" solid />
          <Text style={styles.deleteText}>{deleteLabel}</Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', marginBottom: 12 },
  // Only the strip the row slides away from is red — nothing red sits behind the rest of the
  // row (e.g. a selected row). Square left edge; right corners set inline to match the row.
  actionArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_WIDTH,
    backgroundColor: brandColors.error,
  },
  deleteButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  deleteText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, color: '#FFFFFF' },
});
