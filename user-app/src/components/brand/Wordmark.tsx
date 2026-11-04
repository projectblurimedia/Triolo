import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';

/*
 * The NearbyU name (V4, docs/brand-nearbyu): "Nearby" in Nunito Black, the U glowing from
 * turmeric to saffron, and a soft line under the word that warms to saffron at the U — the road
 * reaching you. Nunito_900Black is loaded in App.tsx.
 * (Copied between user-app and partner-app — keep in sync.)
 */
export const BRAND_FONT = 'Nunito_900Black';

let gradientCount = 0;

export function Wordmark({ size = 24, color = '#FFFFFF', style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const id = React.useMemo(() => `wmU${++gradientCount}`, []);
  const uWidth = size * 0.8;
  const lineHeight = size * 1.12;
  return (
    <View style={[styles.wrap, { paddingBottom: size * 0.16 }, style]} accessible accessibilityRole="header" accessibilityLabel="NearbyU">
      <View style={styles.row}>
        <Text style={[styles.word, { fontSize: size, lineHeight, color }]} allowFontScaling={false}>
          Nearby
        </Text>
        <Svg width={uWidth} height={lineHeight}>
          <Defs>
            <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFE08A" />
              <Stop offset="1" stopColor="#FF9F1C" />
            </SvgGradient>
          </Defs>
          {/* Same baseline as the Text beside it (Nunito's ascent is about 1.01 em). */}
          <SvgText x={0} y={size * 0.92} fontFamily={BRAND_FONT} fontSize={size} fill={`url(#${id})`}>
            U
          </SvgText>
        </Svg>
      </View>
      <LinearGradient
        colors={[`${color}00`, `${color}8C`, '#FFB547']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.line, { height: Math.max(2, size * 0.12), borderRadius: size, left: size * 0.05, right: size * 0.15 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  word: { fontFamily: BRAND_FONT, includeFontPadding: false, letterSpacing: -0.2 },
  line: { position: 'absolute', bottom: 0 },
});
