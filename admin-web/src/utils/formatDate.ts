/** Short, locale-formatted date for admin-facing "registered"/"last updated" timestamps — no date library needed for this one use. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
