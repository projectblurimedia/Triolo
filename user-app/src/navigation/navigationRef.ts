import { createNavigationContainerRef } from '@react-navigation/native';

// Lets screens shown in modals (which sit outside the tab they were opened from) move to
// another tab. Attached via `ref` on RootNavigator's NavigationContainer.
export const navigationRef = createNavigationContainerRef();

/** Goes to the Prepare List tab and opens a fresh, empty list to write. */
export function openNewList(): void {
  if (!navigationRef.isReady()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigationRef.navigate as any)('PrepareList', { newList: Date.now() });
  } catch {
    // Not signed in (no tabs mounted) — nothing to open.
  }
}
