import { createNavigationContainerRef } from '@react-navigation/native';
import { MainStackParamList } from './types';

// Lets code outside the component tree (usePushNotifications.ts's notification-response
// handling, backgroundNotificationTask.ts) trigger navigation — a notification tap has no
// natural React component to call useNavigation() from. Attached via `ref` on RootNavigator's
// <NavigationContainer>.
export const navigationRef = createNavigationContainerRef<MainStackParamList>();

/**
 * Jumps to the Bookings tab specifically, regardless of whichever tab was last active —
 * used when a Quick Book push notification's body (not an Accept/Reject action) is tapped.
 * A no-op if the container isn't ready yet (rare — would mean a push arrived and was tapped
 * before RootNavigator ever mounted) or the user isn't past auth/verification (MainTabs
 * doesn't exist yet in that case); safe to just do nothing rather than crash.
 */
export function navigateToBookings(mode?: 'jobs' | 'orders', tab?: 'requests' | 'active' | 'history'): void {
  if (!navigationRef.isReady()) {
    return;
  }
  try {
    navigationRef.navigate('MainTabs', {
      screen: 'Bookings',
      params: mode || tab ? { mode, tab, linkedAt: Date.now() } : undefined,
    });
  } catch {
    // MainTabs isn't the mounted route tree right now (e.g. still on ChooseCapability) —
    // nothing sensible to do here; the worker can still open Bookings manually.
  }
}
