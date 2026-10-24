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
  AppState,
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
// Settling: the watchdog's beat, how long the list must be still first, and when a fling
// that never reported its end is treated as over.
const WATCHDOG_MS = 250;
const SETTLE_AFTER_MS = 260;
const STUCK_FLING_MS = 900;
// How long our own animated scroll (opening / closing the room) is left alone.
const AUTO_SCROLL_MS = 380;
// A drag that never reported its end (the touch was taken elsewhere) is treated as over.
const STUCK_DRAG_MS = 2500;
// How often a still list re-asserts its place (see the watchdog).
const PIN_EVERY_MS = 500;
// The list stays invisible until it's been placed past the room (so it never shows a jump up
// on opening): shown a moment after that placement, or after this at the latest.
const REVEAL_AFTER_PLACE_MS = 60;
const REVEAL_AT_LATEST_MS = 700;

type Phase = 'idle' | 'pulling' | 'refreshing' | 'done';
type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

interface ScrollableProps {
  onScroll?: (event: ScrollEvent) => void;
  onScrollBeginDrag?: (event: ScrollEvent) => void;
  onScrollEndDrag?: (event: ScrollEvent) => void;
  onMomentumScrollBegin?: (event: ScrollEvent) => void;
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
 * (Copied from user-app — keep in sync; only the bubble's colours differ.)
 *
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
  const pull = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const [viewportHeight, setViewportHeight] = useState(0);
  // Whether the start of the list counts as a snap point (the room can open).
  const [roomOpenable, setRoomOpenable] = useState(false);
  const roomOpenableRef = useRef(false);
  const scroller = useRef<Scroller | null>(null);
  // 0 until the list reports, so the first layout places it past the room (in case the
  // platform ignores the starting `contentOffset`).
  const y = useRef(0);
  const dragging = useRef(false);
  const momentum = useRef(false);
  const lastScrollAt = useRef(0);
  // While our own animated scroll runs, nothing re-settles the list (it would restart it).
  const autoScrollUntil = useRef(0);
  const lastPinAt = useRef(0);
  // The person themselves pulled the room open (only that may refresh).
  const userPull = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  const contentHeight = useRef(0);
  const viewport = useRef(0);
  // Space added under short content so the list can always rest past the room (a minimum
  // height alone isn't always honoured — then the room stayed showing above the content).
  const [pad, setPad] = useState(0);
  const padRef = useRef(0);
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
    if (animated) autoScrollUntil.current = Date.now() + AUTO_SCROLL_MS;
    const target = scroller.current;
    if (target?.scrollToOffset) target.scrollToOffset({ offset: to, animated });
    else target?.scrollTo?.({ x: 0, y: to, animated });
  };

  const busy = () => phaseRef.current === 'refreshing' || phaseRef.current === 'done';

  const runRefresh = async () => {
    userPull.current = false;
    setPhaseBoth('refreshing');
    setOpenable(true);
    const startedAt = Date.now();
    try {
      // A refresh that never answers can't hold the spinner open for ever.
      await Promise.race([Promise.resolve(onRefreshRef.current()), sleep(MAX_WAIT_MS)]);
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
    setOpenable(false);
    scrollTo(ROOM, true);
    // The bubble fades out with the closing room; idle once it's shut.
    await sleep(AUTO_SCROLL_MS);
    if (mounted.current && phaseRef.current === 'done') setPhaseBoth('idle');
  };

  /**
   * Whenever the list has come to rest (finger off, no fling, not our own scroll): pulled
   * past halfway by the person → open fully and refresh; anything else that leaves the room
   * showing — a short pull, new content, a list swapped in, the keyboard — closes it again.
   * So the room (and its arrow) can never stay showing on its own.
   */
  const settle = () => {
    if (dragging.current || momentum.current || busy() || Date.now() < autoScrollUntil.current) return;
    const top = y.current;
    if (top >= ROOM - 0.5) {
      userPull.current = false;
      setOpenable(false);
      if (phaseRef.current === 'pulling') setPhaseBoth('idle');
      return;
    }
    if (userPull.current && ROOM - top >= HALF) {
      if (top > 1) scrollTo(0, true);
      runRefresh();
      return;
    }
    userPull.current = false;
    setOpenable(false);
    scrollTo(ROOM, revealedRef.current && top > 1);
    if (phaseRef.current === 'pulling') setPhaseBoth('idle');
  };

  const reveal = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    if (mounted.current) setRevealed(true);
  };

  /** Place the list past the room (out of sight), then show it. */
  const placeThenReveal = () => {
    if (revealedRef.current || viewport.current === 0 || contentHeight.current < viewport.current + ROOM - 1) return;
    scrollTo(ROOM, false);
    setTimeout(reveal, REVEAL_AFTER_PLACE_MS);
  };

  useEffect(() => {
    // At the latest: place it once more, then show it.
    const timer = setTimeout(() => {
      scrollTo(ROOM, false);
      setTimeout(reveal, REVEAL_AFTER_PLACE_MS);
    }, REVEAL_AT_LATEST_MS);
    // A light watchdog: once the list has been still for a moment, settle it. Catches every
    // case no scroll event reports (a release with no fling, a list that changed under it).
    const watchdog = setInterval(() => {
      const still = Date.now() - lastScrollAt.current;
      if (still > STUCK_FLING_MS) momentum.current = false;
      if (still > STUCK_DRAG_MS) dragging.current = false;
      if (still > SETTLE_AFTER_MS) {
        settle();
        // Android can move a list back to the top with no scroll event (a screen re-attached
        // when the app opens or a tab comes back), uncovering the room while we still think
        // it's in place. So once it's still, its last known place is asserted again — a no-op
        // when nothing moved, and the gap is closed within a beat when something did.
        const now = Date.now();
        if (
          now - lastPinAt.current > PIN_EVERY_MS &&
          !dragging.current &&
          !momentum.current &&
          !busy() &&
          !userPull.current &&
          now >= autoScrollUntil.current &&
          AppState.currentState === 'active'
        ) {
          lastPinAt.current = now;
          scrollTo(Math.max(y.current, ROOM), false);
        }
      }
    }, WATCHDOG_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(watchdog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const child = children;
  const props = child.props;

  const onScroll = (event: ScrollEvent) => {
    y.current = event.nativeEvent.contentOffset.y;
    lastScrollAt.current = Date.now();
    const pulled = Math.max(0, ROOM - y.current);
    pull.setValue(pulled);
    if (dragging.current && !busy()) {
      // Only a finger in the room may open it on letting go.
      setOpenable(y.current < ROOM);
      if (pulled > 0) {
        setPhaseBoth('pulling');
        userPull.current = true;
      }
    }
    props.onScroll?.(event);
  };

  const onScrollBeginDrag = (event: ScrollEvent) => {
    dragging.current = true;
    momentum.current = false;
    autoScrollUntil.current = 0;
    reveal();
    props.onScrollBeginDrag?.(event);
  };

  const onScrollEndDrag = (event: ScrollEvent) => {
    dragging.current = false;
    y.current = event.nativeEvent.contentOffset.y;
    lastScrollAt.current = Date.now();
    // A fling (and its snap) reports its own end; without one this settles it.
    setTimeout(settle, 140);
    props.onScrollEndDrag?.(event);
  };

  const onMomentumScrollBegin = (event: ScrollEvent) => {
    momentum.current = true;
    props.onMomentumScrollBegin?.(event);
  };

  const onMomentumScrollEnd = (event: ScrollEvent) => {
    momentum.current = false;
    y.current = event.nativeEvent.contentOffset.y;
    settle();
    props.onMomentumScrollEnd?.(event);
  };

  /** Keeps the content at least a screen plus the room tall, so it can rest past the room. */
  const fitPad = () => {
    if (!viewport.current || !contentHeight.current) return;
    const own = contentHeight.current - padRef.current;
    const next = Math.max(0, Math.ceil(viewport.current + ROOM - own));
    if (Math.abs(next - padRef.current) > 1) {
      padRef.current = next;
      if (mounted.current) setPad(next);
    }
  };

  const onContentSizeChange = (width: number, height: number) => {
    contentHeight.current = height;
    // Content that shrank pulls the list up with it, without a scroll event: follow it.
    if (viewport.current) y.current = Math.min(y.current, Math.max(0, height - viewport.current));
    fitPad();
    placeThenReveal();
    settle();
    props.onContentSizeChange?.(width, height);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
    viewport.current = event.nativeEvent.layout.height;
    fitPad();
    placeThenReveal();
    settle();
    props.onLayout?.(event);
  };

  const childRef = (props as { ref?: Ref<unknown> }).ref ?? (child as unknown as { ref?: Ref<unknown> }).ref;
  const setRef = useCallback(
    (node: unknown) => {
      if (node && node !== scroller.current) y.current = 0;
      scroller.current = node as Scroller | null;
      if (typeof childRef === 'function') childRef(node);
      else if (childRef && typeof childRef === 'object') (childRef as { current: unknown }).current = node;
    },
    [childRef],
  );

  const room = <View style={{ height: ROOM }} />;
  const spacer = pad ? <View style={{ height: pad }} /> : null;
  const isList = props.renderItem !== undefined;
  const scrollable = cloneElement(
    child,
    {
      ref: setRef,
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
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
            ListFooterComponent: (
              <>
                {renderHeader((props as { ListFooterComponent?: ScrollableProps['ListHeaderComponent'] }).ListFooterComponent)}
                {spacer}
              </>
            ),
          }
        : {}),
    } as Partial<ScrollableProps>,
    ...(isList ? [] : [room, props.children, spacer]),
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
      <View style={[styles.fill, { opacity: revealed ? 1 : 0 }]}>{scrollable}</View>
      <Animated.View
        pointerEvents="none"
        style={[styles.bubbleWrap, { opacity: phase === 'idle' ? 0 : 1, transform: [{ translateY: bubbleY }] }]}
      >
        <Animated.View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
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
    elevation: 4,
  },
  ring: { borderRadius: BUBBLE / 2, borderWidth: 2 },
});
