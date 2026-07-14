/**
 * Points at the local backend during development. When testing on a physical
 * device via Expo Go, 'localhost' refers to the phone itself, not your PC — use
 * your PC's LAN IP instead (phone and PC must be on the same Wi-Fi network).
 * Find it with `ipconfig` (Windows) — look for the Wi-Fi adapter's IPv4 address.
 * Override per environment once staging/production API URLs exist (see
 * ../../docs/deployment.md).
 */
export const API_BASE_URL = 'http://192.168.31.232:4000/api/v1';
