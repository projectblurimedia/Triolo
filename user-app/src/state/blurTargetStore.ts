import { RefObject } from 'react';
import { Platform, View } from 'react-native';
import { create } from 'zustand';

/**
 * Real blur on Android (expo-blur's Dimezis method) can only blur content inside a
 * `BlurTargetView` that the `BlurView` is handed a ref to. Each tab screen is wrapped in its
 * own target (`ScreenBlurTarget`, via `Tab.Navigator`'s `screenLayout`) and registers its ref
 * here by route key; `CustomTabBar` looks up the active tab's ref so its glass blurs exactly
 * the screen scrolling behind it.
 *
 * Android 12+ (API 31) only — below that, blurring every frame is too slow (expo-blur's own
 * `dimezisBlurViewSdk31Plus` method refuses it too), so the bar falls back to a frosted fill.
 */
export const ANDROID_REAL_BLUR = Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 31;

interface BlurTargetState {
  targets: Record<string, RefObject<View | null>>;
  register: (routeKey: string, ref: RefObject<View | null>) => void;
  unregister: (routeKey: string) => void;
}

export const useBlurTargetStore = create<BlurTargetState>((set) => ({
  targets: {},
  register: (routeKey, ref) => set((state) => ({ targets: { ...state.targets, [routeKey]: ref } })),
  unregister: (routeKey) =>
    set((state) => {
      const { [routeKey]: _removed, ...rest } = state.targets;
      return { targets: rest };
    }),
}));
