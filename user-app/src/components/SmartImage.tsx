import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ImageProps, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useThemeColors } from '@/theme';

type SmartImageProps = Omit<ImageProps, 'style'> & { style?: StyleProp<ImageStyle> };

/**
 * An image that never pops in from nothing: a soft shimmering skeleton fills its box while it
 * loads, then the picture fades in over it. If it fails, the skeleton settles into a quiet
 * placeholder icon. Drop-in for `<Image>` (same props; size and corners come from `style`).
 */
export function SmartImage({ style, onLoad, onError, resizeMode = 'cover', ...rest }: SmartImageProps) {
  const { colors, isDark } = useThemeColors();
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const fade = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const uri = typeof rest.source === 'object' && rest.source && 'uri' in rest.source ? rest.source.uri : undefined;

  // A new picture starts over from the skeleton.
  useEffect(() => {
    setState('loading');
    fade.setValue(0);
  }, [uri, fade]);

  useEffect(() => {
    if (state !== 'loading') return;
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    shimmer.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [state, shimmer]);

  const flat = (StyleSheet.flatten(style) ?? {}) as ImageStyle;
  const box: ViewStyle = { ...(flat as ViewStyle), overflow: 'hidden' };
  const base = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,40,90,0.07)';
  const sheen = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.65)';
  const sweep = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-Math.max(width, 80), Math.max(width, 80)] });

  return (
    <View style={box} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {state !== 'loaded' ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: base }]}>
          {state === 'loading' ? (
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: sweep }] }]}>
              <LinearGradient
                colors={['transparent', sheen, 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : (
            <FontAwesome6 name="image" size={18} color={colors.textMuted} />
          )}
        </View>
      ) : null}
      <Animated.Image
        {...rest}
        resizeMode={resizeMode}
        style={[StyleSheet.absoluteFill, { opacity: fade }]}
        onLoad={(event) => {
          setState('loaded');
          Animated.timing(fade, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
          onLoad?.(event);
        }}
        onError={(event) => {
          setState('error');
          onError?.(event);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
