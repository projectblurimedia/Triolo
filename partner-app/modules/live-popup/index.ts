import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

interface LivePopupNative {
  canUseFullScreen(): boolean;
  openFullScreenSettings(): void;
  canDrawOverlays(): boolean;
  openOverlaySettings(): void;
  /** labels: "Later|View|Accept" in the app's language. */
  show(id: string, kind: string, title: string, body: string, url: string, labels: string): void;
  cancel(id: string): void;
}

/**
 * The full-screen pop-up for new jobs / orders (Partner app 1.3+). Null on builds without the
 * native part (older APKs, iOS), so callers fall back to normal notifications.
 */
export const LivePopup: LivePopupNative | null = Platform.OS === 'android' ? requireOptionalNativeModule<LivePopupNative>('LivePopup') : null;

/** Where the pop-up opens the app: the Live Requests screen. */
export const LIVE_URL = 'triolopartner://live';
