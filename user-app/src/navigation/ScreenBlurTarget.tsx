import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { ANDROID_REAL_BLUR, useBlurTargetStore } from '@/state/blurTargetStore';

/**
 * Wraps one tab screen so the glass tab bar can really blur it on Android 12+ — see
 * `state/blurTargetStore.ts`. Everywhere else (iOS, older Android) it's a passthrough: iOS
 * blurs whatever is behind it natively, and older Android uses a frosted fill instead.
 */
export function ScreenBlurTarget({ routeKey, children }: PropsWithChildren<{ routeKey: string }>) {
  const ref = useRef<View>(null);
  const register = useBlurTargetStore((state) => state.register);
  const unregister = useBlurTargetStore((state) => state.unregister);

  useEffect(() => {
    if (!ANDROID_REAL_BLUR) return;
    // Registered after mount, once `ref.current` is set — the bar re-renders on this and
    // hands the now-populated ref to its BlurView.
    register(routeKey, ref);
    return () => unregister(routeKey);
  }, [routeKey, register, unregister]);

  if (!ANDROID_REAL_BLUR) {
    return <>{children}</>;
  }

  return (
    <BlurTargetView ref={ref} style={styles.fill}>
      {children}
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
