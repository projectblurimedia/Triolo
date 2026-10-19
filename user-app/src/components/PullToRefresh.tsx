import React, {
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { colors as brandColors, useThemeColors } from '@/theme';
import { useGlass } from './Glass';
import { LoadingIndicator } from './LoadingIndicator';

// The hidden room above the content: how far it opens, and so the gap the spinner sits in
// while refreshing. Letting go past half of it opens it (and refreshes); less closes it.
const ROOM = 96;
const HALF = ROOM / 2;
const BUBBLE = 40;
// The spinner shows at least this long, so a fast refresh doesn't just flicker.
const MIN_SPIN_MS = 700;
const DONE_MS = 420;
const MAX_WAIT_MS = 15000;

type Phase = 'idle' | 'pulling' | 'refreshing' | 'done';
type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

interface ScrollableProps {
  onScroll?: (event: ScrollEvent) => void;
  onScrollBeginDrag?: (event: ScrollEvent) => void;
  onScrollEndDrag?: (event: ScrollEvent) => void;
  onMomentumScrollEnd?: (event: ScrollEvent) => void;
  onContentSizeChange?: (width: number, height: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  scrollEventThrottle?: number;
  overScrollMode?: string;
  bounces?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentOffset?: { x: number; y: number };
  snapToOffsets?: number[];
  snapToStart?: boolean;
  snapToEnd?: boolean;
  children?: ReactNode;
  renderItem?: unknown;
  ListHeaderComponent?: ReactNode | React.ComponentType;
  ref?: Ref<unknown>;
}

interface PullToRefreshProps {
  /** Whether the data is reloading — only read after a pull, so background polling never shows the spinner. */
  refreshing: boolean;
  onRefresh: () => unknown;
  style?: StyleProp<ViewStyle>;
  /** One vertical ScrollView or FlatList. It gets this component's scroll handling. */
  children: ReactElement<ScrollableProps>;
}

type Scroller = {
  scrollTo?: (o: { x?: number; y: number; animated?: boolean }) => void;
  scrollToOffset?: (o: { offset: number; animated?: boolean }) => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function renderHeader(header: ScrollableProps['ListHeaderComponent']): ReactNode {
  if (!header) return null;
  if (isValidElement(header)) return header;
  return React.createElement(header as React.ComponentType);
}

/**
 * Our own pull-to-refresh (instead of the platform RefreshControl): pull down at the top and
 * the content comes down with a bubble in the gap (its arrow turns past halfway). Let go past
 * halfway and it opens fully with a spinner while the data reloads, shows a tick, then glides
 * back; less than halfway and it just closes.
 *
 * How it stays smooth: the list has a hidden room of ROOM px above its content and rests just
 * past it, so the pull is the list's own native scroll (nothing has to win the finger from it),
 * and opening / closing after you let go is the scroll view's own native snapping
 * (`snapToOffsets`), so nothing in JavaScript moves the list while you pull or let go — that
 * is what made earlier versions stutter on busy screens. `snapToStart` is only on while the
 * finger is in the room (or it's refreshing), so a fast fling up through the content stops at
 * the top of the content instead of opening the room.
 *
 * Wrap one vertical ScrollView / FlatList and drop its `refreshControl`. Offsets the child
 * reports include the room.
 */
export function PullToRefresh({ refreshing, onRefresh, style, children }: PullToRefreshProps) {
  const { colors } = useThemeColors();
  const glass = useGlass();
  const pull = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const [viewportHeight, setViewportHeight] = useState(0);
  // Whether the start of the list counts as a snap point (the room can open).
  const [roomOpenable, setRoomOpenable] = useState(false);
  const roomOpenableRef = useRef(false);
  const scroller = useRef<Scroller | null>(null);
  // Unknown until the list reports; 0 makes the first content size place it past the room
  // (in case the platform ignores the starting `contentOffset`).
  const y = useRef(0);
  const dragging = useRef(false);
  const touched = useRef(false);
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
    if (phaseRef.current === next) return;
    phaseRef.current = next;
    if (mounted.current) setPhase(next);
  };

  const setOpenable = (next: boolean) => {
    if (roomOpenableRef.current === next) return;
    roomOpenableRef.current = next;
    if (mounted.current) setRoomOpenable(next);
  };

  const scrollTo = (to: number, animated: boolean) => {
    const target = scroller.current;
    if (target?.scrollToOffset) target.scrollToOffset({ offset: to, animated });
    else target?.scrollTo?.({ x: 0, y: to, animated });
  };

  const busy = () => phaseRef.current === 'refreshing' || phaseRef.current === 'done';

  const runRefresh = async () => {
    setPhaseBoth('refreshing');
    setOpenable(true);
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
    setPhaseBoth('idle');
    setOpenable(false);
    if (y.current < ROOM) scrollTo(ROOM, true);
  };

  /** After the finger is off: fully open → refresh; closed → back to idle. */
  const settle = () => {
    if (dragging.current || busy()) return;
    if (y.current <= 1) {
      runRefresh();
    } else if (y.current >= ROOM - 1) {
      setPhaseBoth('idle');
      setOpenable(false);
    }
  };

  const child = children;
  const props = child.props;

  const onScroll = (event: ScrollEvent) => {
    y.current = event.nativeEvent.contentOffset.y;
    const pulled = Math.max(0, ROOM - y.current);
    pull.setValue(pulled);
    if (dragging.current && !busy()) {
      // Only a finger in the room may open it on letting go.
      setOpenable(y.current < ROOM);
      if (pulled > 0) setPhaseBoth('pulling');
    }
    settle();
    props.onScroll?.(event);
  };

  const onScrollBeginDrag = (event: ScrollEvent) => {
    dragging.current = true;
    touched.current = true;
    props.onScrollBeginDrag?.(event);
  };

  const onScrollEndDrag = (event: ScrollEvent) => {
    dragging.current = false;
    y.current = event.nativeEvent.contentOffset.y;
    settle();
    props.onScrollEndDrag?.(event);
  };

  const onMomentumScrollEnd = (event: ScrollEvent) => {
    y.current = event.nativeEvent.contentOffset.y;
    settle();
    props.onMomentumScrollEnd?.(event);
  };

  const onContentSizeChange = (width: number, height: number) => {
    // Until the person first touches it, keep the list resting past the room (the content and
    // the room's minimum height can arrive in any order).
    if (!touched.current && !busy() && y.current < ROOM - 0.5) scrollTo(ROOM, false);
    props.onContentSizeChange?.(width, height);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
    props.onLayout?.(event);
  };

  const childRef = (props as { ref?: Ref<unknown> }).ref ?? (child as unknown as { ref?: Ref<unknown> }).ref;
  const setRef = useCallback(
    (node: unknown) => {
      scroller.current = node as Scroller | null;
      if (typeof childRef === 'function') childRef(node);
      else if (childRef && typeof childRef === 'object') (childRef as { current: unknown }).current = node;
    },
    [childRef],
  );

  const room = <View style={{ height: ROOM }} />;
  const isList = props.renderItem !== undefined;
  const scrollable = cloneElement(
    child,
    {
      ref: setRef,
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollEnd,
      onContentSizeChange,
      onLayout,
      scrollEventThrottle: props.scrollEventThrottle ?? 16,
      overScrollMode: 'never',
      bounces: false,
      contentOffset: { x: 0, y: ROOM },
      // Native snapping does the opening / closing: the room's edge is a snap point; the start
      // of the list only while the room may open; free scrolling everywhere past the room.
      snapToOffsets: [ROOM],
      snapToStart: roomOpenable,
      snapToEnd: false,
      // Always tall enough to rest past the room, however short the content.
      contentContainerStyle: [props.contentContainerStyle, viewportHeight ? { minHeight: viewportHeight + ROOM } : null],
      ...(isList
        ? {
            ListHeaderComponent: (
              <>
                {room}
                {renderHeader(props.ListHeaderComponent)}
              </>
            ),
          }
        : {}),
    } as Partial<ScrollableProps>,
    ...(isList ? [] : [room, props.children]),
  );

  // The bubble rides in the gap the pull opens up, fading and growing in as you pull.
  const bubbleY = pull.interpolate({
    inputRange: [0, ROOM],
    outputRange: [-BUBBLE, (ROOM - BUBBLE) / 2],
    extrapolate: 'clamp',
  });
  const bubbleOpacity = pull.interpolate({ inputRange: [0, 14, 36], outputRange: [0, 0.2, 1], extrapolate: 'clamp' });
  const bubbleScale = pull.interpolate({ inputRange: [0, HALF], outputRange: [0.55, 1], extrapolate: 'clamp' });
  const arrowTurn = pull.interpolate({ inputRange: [18, HALF], outputRange: ['0deg', '180deg'], extrapolate: 'clamp' });
  // A ring that fills in brand colour once letting go would refresh.
  const ringOpacity = pull.interpolate({ inputRange: [HALF - 14, HALF], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={[styles.fill, style]}>
      {scrollable}
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
