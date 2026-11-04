import React, { useMemo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Mask, Path, Rect } from 'react-native-svg';

/*
 * The NearbyU mark (docs/brand-nearbyu): a location pin, a slim U-shaped road, and a home on the
 * road's right arm with the road running into its door. Drawn in a 120 × 120 box. Holes (the
 * pin's hole, the door, the road's dashes, the gap round the pin) are cut out with masks, so the
 * mark works on any background in a single colour.
 * (Copied between user-app and partner-app — keep in sync.)
 */
export const ROAD = 'M27 54V70A33 33 0 0 0 93 70V58H79V70A19 19 0 0 1 41 70V54Z';
export const ROAD_DASHES = 'M34 60V70A26 26 0 0 0 86 70V62';
/** The road's middle line, for drawing it in from the pin to the home. */
export const ROAD_CENTRE = 'M34 50V70A26 26 0 0 0 86 70V56';
export const ROAD_LENGTH = 130;
export const HOME = 'M68 59V40H62L86 16L110 40H104V59Z';
export const DOOR = 'M79.5 59.5V50.5a6.5 6.5 0 0 1 13 0V59.5Z';
export const PIN = 'M34 57C29 50.5 17 40.5 17 26.5A17 17 0 0 1 51 26.5C51 40.5 39 50.5 34 57Z';

let maskCount = 0;
export function useMaskId(prefix: string): string {
  return useMemo(() => `${prefix}${++maskCount}`, [prefix]);
}

/** The road with its dashes cut out, and a gap where the pin sits on it. */
export function RoadShape({ color, id }: { color: string; id: string }) {
  return (
    <>
      <Defs>
        <Mask id={id} x="0" y="0" width="120" height="120" maskUnits="userSpaceOnUse">
          <Path d={ROAD} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={1.5} strokeLinejoin="round" />
          <Path d={ROAD_DASHES} fill="none" stroke="#000000" strokeWidth={2.4} strokeDasharray="4 5.5" strokeLinecap="round" />
          <Path d={PIN} fill="#000000" stroke="#000000" strokeWidth={3} strokeLinejoin="round" />
        </Mask>
      </Defs>
      <Rect x="0" y="0" width="120" height="120" fill={color} mask={`url(#${id})`} />
    </>
  );
}

/** The home with its door cut out and the door handle. */
export function HomeShape({ color, id }: { color: string; id: string }) {
  return (
    <>
      <Defs>
        <Mask id={id} x="0" y="0" width="120" height="120" maskUnits="userSpaceOnUse">
          <Path d={HOME} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={2.5} strokeLinejoin="round" />
          <Path d={DOOR} fill="#000000" />
          <Circle cx={89.3} cy={54.5} r={1.4} fill="#FFFFFF" />
        </Mask>
      </Defs>
      <Rect x="0" y="0" width="120" height="120" fill={color} mask={`url(#${id})`} />
    </>
  );
}

/** The location pin with its hole cut out. */
export function PinShape({ color, id }: { color: string; id: string }) {
  return (
    <>
      <Defs>
        <Mask id={id} x="0" y="0" width="120" height="120" maskUnits="userSpaceOnUse">
          <Path d={PIN} fill="#FFFFFF" />
          <Circle cx={34} cy={26.5} r={6.6} fill="#000000" />
        </Mask>
      </Defs>
      <Rect x="0" y="0" width="120" height="120" fill={color} mask={`url(#${id})`} />
    </>
  );
}

/** The whole mark, still. `size` is its width; it is drawn in its own tight box. */
export function NearbyMark({ size, color = '#FFFFFF', style }: { size: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const road = useMaskId('road');
  const home = useMaskId('home');
  const pin = useMaskId('pin');
  return (
    <View style={[{ width: size, height: (size * 100) / 104 }, style]}>
      <Svg width="100%" height="100%" viewBox="10 10 104 100">
        <G>
          <RoadShape color={color} id={road} />
          <HomeShape color={color} id={home} />
          <PinShape color={color} id={pin} />
        </G>
      </Svg>
    </View>
  );
}
