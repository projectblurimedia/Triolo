/**
 * node-postgres only auto-parses array columns of built-in types (text[], int4[], ...).
 * Arrays of custom enum types (e.g. worker_skill_category[]) come back as the raw
 * Postgres array-literal string ("{electrician,other}") because pg has no type parser
 * registered for their OIDs. Parse that literal back into a string[] ourselves.
 */
export function parsePgArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.replace(/^\{/, '').replace(/\}$/, '');
    if (trimmed === '') {
      return [];
    }
    return trimmed.split(',').map((item) => item.replace(/^"|"$/g, ''));
  }
  return [];
}
