/** "Ravi Kumar" → "Ravi" (for map labels and short greetings). */
export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}
