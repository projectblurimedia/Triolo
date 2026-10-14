import React, { cloneElement, ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { colors as brandColors, useThemeColors } from '@/theme';
import { useGlass } from './Glass';
import { LoadingIndicator } from './LoadingIndicator';

// How far the content moves (it resists more the further you pull), where a release counts as a
// refresh, and where the content rests while refreshing.
const MAX_PULL = 150;
const TRIGGER = 76;
const HOLD = 68;
const BUBBLE = 40;
// The spinner shows at least this long, so a fast refresh doesn't just flicker.
const MIN_SPIN_MS = 700;
const DONE_MS = 420;
const MAX_WAIT_MS = 15000;

type Phase = 'idle' | 'pulling' | 'refreshing' | 'done';

interface PullToRefreshProps {
  /** Whether the data is reloading — only read after a pull, so background polling never shows the spinner. */
  refreshing: boolean;
  onRefresh: () => unknown;
  style?: StyleProp<ViewStyle>;
  /** A ScrollView or FlatList; it gets this component's scroll tracking. */
  children: ReactElement<{
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle?: number;
    overScrollMode?: string;
    bounces?: boolean;
  }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Rubber-band resistance: follows the finger at first, then gets heavier towards MAX_PULL. */
function resist(distance: number): number {
  return MAX_PULL * (1 - Math.exp(-distance / MAX_PULL));
}

/**
 * Pull-to-refresh that replaces the platform RefreshControl: pull down at the top and the
 * whole list moves down with a glass bubble following it (its arrow turns as you reach the
 * release point). Let go past it and the list rests open with a spinner while the data
 * reloads, shows a tick, then glides back up.
 *
 * Wrap one ScrollView/FlatList and drop its `refreshControl`. The drag is claimed by a JS
 * responder that blocks the native scroll view only while the list is at the very top and
 * the finger moves down, so ordinary scrolling and sideways carousels are untouched.
 */
export function PullToRefresh({ refreshing, onRefresh, style, children }: PullToRefreshProps) {
  const { colors } = useThemeColors();
  const glass = useGlass();
  const pull = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const scrollY = useRef(0);
  // Finger position when the drag was claimed, so the list doesn't jump on the first frame.
  const origin = useRef(0);
  const startOffset = useRef(0);
  const refreshingRef = useRef(refreshing);
  const onRefreshRef = useRef(onRefresh);
  const mounted = useRef(true);
  refreshingRef.current = refreshing;
  onRefreshRef.current = onRefresh;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    if (mounted.current) setPhase(next);
  };

  const settle = (to: number, done?: () => void) => {
    Animated.spring(pull, { toValue: to, friction: 9, tension: 70, useNativeDriver: true }).start(() => done?.());
  };

  const runRefresh = async () => {
    setPhaseBoth('refreshing');
    settle(HOLD);
    const startedAt = Date.now();
    try {
      await onRefreshRef.current();
    } catch {
      // The screen shows its own error state; the spinner just closes.
    }
    const spun = Date.now() - startedAt;
    if (spun < MIN_SPIN_MS) await sleep(MIN_SPIN_MS - spun);
    while (refreshingRef.current && Date.now() - startedAt < MAX_WAIT_MS) {
      await sleep(100);
    }
    if (!mounted.current) return;
    setPhaseBoth('done');
    await sleep(DONE_MS);
    if (!mounted.current) return;
    settle(0, () => setPhaseBoth('idle'));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          (phaseRef.current === 'idle' || phaseRef.current === 'refreshing') &&
          scrollY.current <= 0 &&
          g.dy > 4 &&
          g.dy > Math.abs(g.dx) * 1.4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_, g) => {
          pull.stopAnimation();
          startOffset.current = phaseRef.current === 'refreshing' ? HOLD : 0;
          origin.current = g.dy;
          if (phaseRef.current === 'idle') setPhaseBoth('pulling');
        },
        onPanResponderMove: (_, g) => {
          const raw = Math.max(0, g.dy - origin.current);
          pull.setValue(Math.max(startOffset.current, resist(raw + startOffset.current)));
        },
        onPanResponderRelease: (_, g) => {
          const raw = Math.max(0, g.dy - origin.current);
          const reached = resist(raw + startOffset.current);
          if (phaseRef.current === 'refreshing') {
            settle(HOLD);
          } else if (reached >= TRIGGER) {
            runRefresh();
          } else {
            settle(0, () => {
              if (phaseRef.current === 'pulling') setPhaseBoth('idle');
            });
          }
        },
        onPanResponderTerminate: () => {
          if (phaseRef.current === 'refreshing') {
            settle(HOLD);
          } else {
            settle(0, () => setPhaseBoth('idle'));
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const child = children;
  const childOnScroll = child.props.onScroll;
  const scrollable = cloneElement(child, {
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = event.nativeEvent.contentOffset.y;
      childOnScroll?.(event);
    },
    scrollEventThrottle: child.props.scrollEventThrottle ?? 16,
    overScrollMode: 'never',
    bounces: false,
  });

  // The bubble rides in the gap the list opens up, fading and growing in as you pull.
  const bubbleY = pull.interpolate({
    inputRange: [0, HOLD, MAX_PULL],
    outputRange: [-BUBBLE, (HOLD - BUBBLE) / 2, (HOLD - BUBBLE) / 2 + (MAX_PULL - HOLD) * 0.45],
    extrapolate: 'clamp',
  });
  const bubbleOpacity = pull.interpolate({ inputRange: [0, 18, 46], outputRange: [0, 0.2, 1], extrapolate: 'clamp' });
  const bubbleScale = pull.interpolate({ inputRange: [0, TRIGGER], outputRange: [0.55, 1], extrapolate: 'clamp' });
  const arrowTurn = pull.interpolate({ inputRange: [24, TRIGGER], outputRange: ['0deg', '180deg'], extrapolate: 'clamp' });
  // A ring that fills in brand colour as the pull approaches the release point.
  const ringOpacity = pull.interpolate({ inputRange: [TRIGGER - 20, TRIGGER], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={[styles.fill, style]} collapsable={false} {...panResponder.panHandlers}>
      <Animated.View pointerEvents="none" style={[styles.bubbleWrap, { transform: [{ translateY: bubbleY }] }]}>
        <Animated.View
          style={[
            styles.bubble,
            {
              backgroundColor: glass.tint,
              borderColor: glass.border,
              opacity: bubbleOpacity,
              transform: [{ scale: bubbleScale }],
            },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.ring,
              { borderColor: colors.primary, opacity: phase === 'pulling' ? ringOpacity : 0 },
            ]}
          />
          {phase === 'refreshing' ? (
            <LoadingIndicator size={22} dotSize={4} color={colors.primary} />
          ) : phase === 'done' ? (
            <FontAwesome6 name="check" size={16} color={brandColors.success} solid />
          ) : (
            <Animated.View style={{ transform: [{ rotate: arrowTurn }] }}>
              <FontAwesome6 name="arrow-down" size={15} color={colors.primary} solid />
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.fill, { transform: [{ translateY: pull }] }]}>{scrollable}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bubbleWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2A5B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  ring: { borderRadius: BUBBLE / 2, borderWidth: 2 },
});
