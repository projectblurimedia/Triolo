/**
 * The browser's current position, with a clear reason when it can't be had.
 * (Copied between admin-web and registration-web — keep in sync.)
 *
 * A computer without GPS often can't get a high-accuracy fix in time, which used to fail every
 * time, so this asks for a quick, network-based fix first (a recent one is fine) and only then
 * for a precise one.
 */

export class LocationError extends Error {
  constructor(readonly reason: 'insecure' | 'unsupported' | 'denied' | 'unavailable' | 'timeout') {
    super(reason);
  }
}

function ask(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
}

export async function currentPosition(): Promise<GeolocationPosition> {
  // Browsers only give the location to https pages (and localhost).
  if (!window.isSecureContext) throw new LocationError('insecure');
  if (!navigator.geolocation) throw new LocationError('unsupported');
  try {
    return await ask({ enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10000 });
  } catch (first) {
    const code = (first as GeolocationPositionError).code;
    if (code === 1) throw new LocationError('denied');
    try {
      return await ask({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    } catch (second) {
      const secondCode = (second as GeolocationPositionError).code;
      if (secondCode === 1) throw new LocationError('denied');
      throw new LocationError(secondCode === 3 ? 'timeout' : 'unavailable');
    }
  }
}

/** What to tell the person when the location couldn't be had. */
export function locationErrorMessage(error: unknown): string {
  const reason = error instanceof LocationError ? error.reason : 'unavailable';
  switch (reason) {
    case 'insecure':
      return 'The browser only shares your location on a secure (https) page or on localhost. Select the place on the map instead.';
    case 'unsupported':
      return "This browser can't share its location. Select the place on the map instead.";
    case 'denied':
      return 'Location is blocked for this site. Click the lock icon in the address bar, allow Location, then try again — or select it on the map.';
    case 'timeout':
      return 'Finding your location took too long. Try again, or select it on the map.';
    default:
      return "This device couldn't find its location (on Windows, check Settings → Privacy → Location is on). Select it on the map instead.";
  }
}
