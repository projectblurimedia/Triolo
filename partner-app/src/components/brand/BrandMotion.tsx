import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Mask, Path, Rect } from 'react-native-svg';
import { HomeShape, PinShape, ROAD, ROAD_CENTRE, ROAD_DASHES, ROAD_LENGTH, PIN, useMaskId } from './NearbyMark';

/*
 * The NearbyU motion (docs/brand-nearbyu): rings ripple out, the pin drops in, the road draws
 * itself to the home, the home pops up, three helpers swing in on the rings and pulse.
 * `intro` plays once (the opening animation, ~1.35 s of motion); `loop` repeats every 2.4 s with
 * a soft fade (the loader). Each part is its own layer so it can move on the native driver; only
 * the road's drawing runs in JS (an SVG stroke offset).
 * (Copied between user-app and partner-app — keep in sync.)
 */
const AnimatedPath = Animated.createAnimatedComponent(Path);

type Seg = [number, number];
interface Timeline {
  duration: number;
  ring1: Seg; ring2: Seg; pin: Seg; road: Seg; home: Seg;
  orbits: [Seg, Seg, Seg]; halos: [Seg, Seg, Seg];
  /** Loop only: when the whole scene fades out. */
  fade?: Seg;
}
// Fractions of the duration. Intro: the opening animation at 1.35× speed. Loop: the loader.
const INTRO: Timeline = {
  duration: 2050,
  ring1: [0, 0.33], ring2: [0.05, 0.38], pin: [0.05, 0.25], road: [0.165, 0.43], home: [0.3, 0.455],
  orbits: [[0.28, 0.55], [0.33, 0.61], [0.38, 0.66]],
  halos: [[0.55, 0.88], [0.61, 0.94], [0.66, 0.99]],
};
const LOOP: Timeline = {
  duration: 2400,
  ring1: [0, 0.16], ring2: [0.03, 0.19], pin: [0, 0.12], road: [0.08, 0.32], home: [0.25, 0.35],
  orbits: [[0.28, 0.46], [0.31, 0.49], [0.34, 0.52]],
  halos: [[0.46, 0.68], [0.5, 0.72], [0.54, 0.76]],
  fade: [0.8, 0.98],
};

// Helpers around the mark (box units), and how far each swings in from.
const HELPERS: { x: number; y: number; r: number; from: number }[] = [
  { x: -6, y: 28, r: 4.4, from: -34 },
  { x: -34, y: 112, r: 4.4, from: 32 },
  { x: 138, y: 118, r: 3.8, from: -30 },
];

interface BrandMotionProps {
  /** Width (and height) of the whole drawing in px. */
  size: number;
  color?: string;
  /** Rings and helpers around the mark (leave out for small sizes such as buttons). */
  rings?: boolean;
  mode: 'intro' | 'loop';
  onDone?: () => void;
}

export function BrandMotion({ size, color = '#FFFFFF', rings = true, mode, onDone }: BrandMotionProps) {
  const tl = mode === 'intro' ? INTRO : LOOP;
  const t = useRef(new Animated.Value(0)).current; // transforms and opacity (native)
  const tJs = useRef(new Animated.Value(0)).current; // the road's stroke offset (JS)
  const roadMask = useMaskId('draw');
  const roadCut = useMaskId('roadcut');
  const homeId = useMaskId('home');
  const pinId = useMaskId('pin');

  useEffect(() => {
    const run = (value: Animated.Value, native: boolean) =>
      Animated.timing(value, { toValue: 1, duration: tl.duration, easing: Easing.linear, useNativeDriver: native });
    if (mode === 'intro') {
      Animated.parallel([run(t, true), run(tJs, false)]).start(({ finished }) => finished && onDone?.());
      return () => {
        t.stopAnimation();
        tJs.stopAnimation();
      };
    }
    const loop = Animated.loop(Animated.parallel([run(t, true), run(tJs, false)]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // The drawing's box: with rings it spans -50…170 (the mark sits in 0…120), without just the mark.
  const origin = rings ? -50 : 4;
  const span = rings ? 220 : 112;
  const unit = size / span;
  const viewBox = `${origin} ${origin} ${span} ${span}`;
  const px = (v: number) => (v - origin) * unit;
  const centre = size / 2;
  // Scale (or move) a full-size layer about a point given in box units.
  type Step = { translateX: Animated.AnimatedInterpolation<number> | number } | { translateY: Animated.AnimatedInterpolation<number> | number } | { scale: Animated.AnimatedInterpolation<number> | number };
  const about = (x: number, y: number, inner: Step[]): Step[] => [
    { translateX: px(x) - centre },
    { translateY: px(y) - centre },
    ...inner,
    { translateX: centre - px(x) },
    { translateY: centre - px(y) },
  ];
  const seg = (s: Seg, out: number[], easing = Easing.out(Easing.cubic)) =>
    t.interpolate<number>({ inputRange: s, outputRange: out, easing, extrapolate: 'clamp' });
  const overshoot = Easing.out(Easing.back(1.7));

  const anim = useMemo(() => {
    const ring = (s: Seg) => ({ opacity: seg(s, [0, 1]), transform: [{ scale: seg(s, [0.4, 1]) }] });
    return {
      ring1: ring(tl.ring1),
      ring2: ring(tl.ring2),
      pin: {
        opacity: seg(tl.pin, [0, 1]),
        transform: about(34, 57, [{ translateY: seg(tl.pin, [-26 * unit, 0], overshoot) }, { scale: seg(tl.pin, [0.6, 1], overshoot) }]),
      },
      home: { opacity: seg(tl.home, [0, 1]), transform: about(86, 59, [{ scale: seg(tl.home, [0.2, 1], overshoot) }]) },
      orbits: tl.orbits.map((s, i) => ({
        opacity: seg([s[0], s[0] + (s[1] - s[0]) * 0.6], [0, 1]),
        transform: [{ rotate: seg(s, [HELPERS[i].from, 0]).interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) }],
      })),
      halos: tl.halos.map((s) => ({
        opacity: t.interpolate({ inputRange: [s[0] - 0.001, s[0], s[0] + 0.02, s[1]], outputRange: [0, 0.7, 0.7, 0], extrapolate: 'clamp' }),
        transform: [{ scale: seg(s, [1, 3.2]) }],
      })),
      scene: tl.fade ? seg(tl.fade, [1, 0], Easing.inOut(Easing.quad)) : 1,
      road: tJs.interpolate({ inputRange: tl.road, outputRange: [ROAD_LENGTH, 0], extrapolate: 'clamp', easing: Easing.inOut(Easing.cubic) }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, rings, mode]);

  const layer = (children: React.ReactNode) => (
    <Svg width={size} height={size} viewBox={viewBox} style={StyleSheet.absoluteFill}>
      {children}
    </Svg>
  );

  return (
    <Animated.View style={{ width: size, height: size, opacity: anim.scene }} pointerEvents="none">
      {rings ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, anim.ring1]}>{layer(<Circle cx={60} cy={60} r={70} fill="none" stroke={color} strokeWidth={1.4} opacity={0.22} />)}</Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, anim.ring2]}>{layer(<Circle cx={60} cy={60} r={100} fill="none" stroke={color} strokeWidth={1.4} opacity={0.14} />)}</Animated.View>
          {HELPERS.map((helper, i) => (
            <Animated.View key={i} style={[StyleSheet.absoluteFill, anim.orbits[i]]}>
              {layer(<Circle cx={helper.x} cy={helper.y} r={helper.r} fill={color} opacity={0.6} />)}
              <Animated.View
                style={[
                  styles.halo,
                  {
                    left: px(helper.x) - helper.r * unit,
                    top: px(helper.y) - helper.r * unit,
                    width: helper.r * 2 * unit,
                    height: helper.r * 2 * unit,
                    borderRadius: helper.r * unit,
                    borderColor: color,
                    borderWidth: Math.max(1, 1.4 * unit),
                  },
                  anim.halos[i],
                ]}
              />
            </Animated.View>
          ))}
        </>
      ) : null}
      {/* The road, drawn in from the pin to the home. */}
      {layer(
        <>
          <Defs>
            <Mask id={roadMask} x={origin} y={origin} width={span} height={span} maskUnits="userSpaceOnUse">
              <AnimatedPath d={ROAD_CENTRE} fill="none" stroke="#FFFFFF" strokeWidth={22} strokeDasharray={`${ROAD_LENGTH} ${ROAD_LENGTH}`} strokeDashoffset={anim.road} />
            </Mask>
            <Mask id={roadCut} x={origin} y={origin} width={span} height={span} maskUnits="userSpaceOnUse">
              <Path d={ROAD} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={1.5} strokeLinejoin="round" />
              <Path d={ROAD_DASHES} fill="none" stroke="#000000" strokeWidth={2.4} strokeDasharray="4 5.5" strokeLinecap="round" />
              <Path d={PIN} fill="#000000" stroke="#000000" strokeWidth={3} strokeLinejoin="round" />
            </Mask>
          </Defs>
          <G mask={`url(#${roadMask})`}>
            <Rect x={origin} y={origin} width={span} height={span} fill={color} mask={`url(#${roadCut})`} />
          </G>
        </>,
      )}
      <Animated.View style={[StyleSheet.absoluteFill, anim.home]}>{layer(<HomeShape color={color} id={homeId} />)}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, anim.pin]}>{layer(<PinShape color={color} id={pinId} />)}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  halo: { position: 'absolute' },
});
