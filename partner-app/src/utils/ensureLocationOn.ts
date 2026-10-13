import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * For actions that need the worker's real location (starting a trip the customer will track):
 * asks for permission if needed, pops Android's own "turn on location" dialog if location is
 * switched off, and opens Settings when permission was permanently denied. Resolves true only
 * when location is actually on and allowed — the caller stops otherwise.
 */
export async function ensureLocationOn(): Promise<boolean> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        await Linking.openSettings();
        return false;
      }
      permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return false;
    }
    if (await Location.hasServicesEnabledAsync()) return true;
    if (Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
      } catch {
        // The worker declined the dialog.
      }
    }
    return Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}
