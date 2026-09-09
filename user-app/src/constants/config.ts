/**
 * Single source of truth for the backend API host. In dev (Expo Go / dev client),
 * always the local LAN IP — when testing on a physical device, 'localhost' refers to
 * the phone itself, not your PC. Find your PC's IP with `ipconfig` (Windows) — look
 * for the Wi-Fi adapter's IPv4 address; phone and PC must be on the same Wi-Fi network.
 *
 * In a built (non-dev) app, uses `EXPO_PUBLIC_API_URL` instead — set per build profile
 * in `eas.json` (see the `preview`/`production` profiles' own `env`), pointing at the
 * deployed Render backend. `FALLBACK_PROD_URL` only matters if that env var is ever
 * missing from a build profile; keep it in sync with eas.json's own value.
 */
const LOCAL_URL = 'http://192.168.1.14:4000/api/v1';
const FALLBACK_PROD_URL = 'https://triolo-backend.onrender.com/api/v1';

export const API_BASE_URL = __DEV__ ? LOCAL_URL : process.env.EXPO_PUBLIC_API_URL || FALLBACK_PROD_URL;
