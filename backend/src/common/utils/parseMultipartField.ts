/**
 * multer parses every multipart/form-data text field as a plain string — there's no
 * native array/boolean type. The client JSON-stringifies arrays (e.g. selected
 * category chips) into a single field; these normalize that back before zod validates.
 */
export function parseJsonIfString(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function parseBooleanIfString(value: unknown): unknown {
  if (typeof value === 'string') {
    return value === 'true';
  }
  return value;
}
