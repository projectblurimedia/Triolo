import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';

/** How big the seal is next to a profile photo — the same proportion everywhere. */
export const SEAL_RATIO = 0.34;
export const sealSizeFor = (photoSize: number) => Math.max(16, Math.round(photoSize * SEAL_RATIO));

const SEAL_GRADIENT = ['#6EE7B7', '#10B981', '#047857'] as const;
const TRUSTED_COLOR = '#059669';

/**
 * (Copied from user-app — keep in sync.)
 * The "Trusted by Triolo" seal: a glossy green disc with a white ring and a white shield with a
 * green tick. Just the picture — callers decide whether the profile is trusted.
 */
export function TrustedSeal({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  const mark = size * 0.56;
  return (
    <View style={[styles.shadow, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <LinearGradient
        colors={SEAL_GRADIENT}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.seal, { borderRadius: size / 2, borderWidth: Math.max(1.5, size * 0.09) }]}
      >
        <View style={[styles.gloss, { height: size * 0.45 }]} />
        <View style={{ width: mark, height: mark }}>
          <View style={styles.center}>
            <FontAwesome6 name="shield" size={mark * 0.92} color="#FFFFFF" solid />
          </View>
          <View style={[styles.center, { paddingTop: mark * 0.04 }]}>
            <FontAwesome6 name="check" size={mark * 0.42} color={TRUSTED_COLOR} solid />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

/** A profile photo with the seal on its top-right edge (when `trusted`). */
export function SealedPhoto({ size, trusted, children }: { size: number; trusted: boolean; children: React.ReactNode }) {
  const seal = sealSizeFor(size);
  return (
    <View style={{ width: size, height: size }}>
      {children}
      {trusted ? <TrustedSeal size={seal} style={[styles.spot, { top: -seal * 0.12, right: -seal * 0.12 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#10B981',
    shadowOpacity: 0.55,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    backgroundColor: '#FFFFFF',
  },
  seal: { flex: 1, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  spot: { position: 'absolute', zIndex: 2 },
});
