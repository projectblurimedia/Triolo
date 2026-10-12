/** "420m" under 1km, "1.3km" otherwise — matches user-app's own nearby-search phrasing. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
