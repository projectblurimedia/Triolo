/** The first word of a person's name, for places too narrow for the whole name. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}
