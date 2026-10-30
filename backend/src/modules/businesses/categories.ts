import { BUSINESS_SHOP_CATEGORIES } from './interfaces';

const FIXED = new Set<string>(BUSINESS_SHOP_CATEGORIES);
const MAX_CUSTOM = 5;

/**
 * The apps send one list of shop kinds: fixed keys (grocery, pharmacy…) plus names shops typed
 * themselves under "other" (e.g. "Fancy"). Split them: the fixed ones are the enum column, the
 * names are matched against `other_category_description` (same idea as bookings' splitSkills).
 */
export function splitShopCategories(input: string[]): { fixed: string[]; custom: string[] } {
  const fixed: string[] = [];
  const custom: string[] = [];
  for (const raw of input) {
    const value = raw.trim();
    if (!value) continue;
    if (FIXED.has(value)) {
      if (!fixed.includes(value)) fixed.push(value);
      continue;
    }
    // Dots and colons would read as i18n key separators where the apps show the names.
    const name = value.replace(/[.:]/g, '').replace(/\s+/g, ' ').trim();
    if (name && !custom.some((entry) => entry.toLowerCase() === name.toLowerCase()) && custom.length < MAX_CUSTOM) {
      custom.push(name);
    }
  }
  return { fixed, custom };
}

/**
 * SQL (for a row alias) true when the shop has one of the fixed kinds `$fixed` or one of the
 * custom names `$custom` (whole name, any case) — or when nothing is asked for at all.
 */
export function shopKindMatchSql(alias: string, fixedParam: string, customParam: string): string {
  return `(($${fixedParam}::business_shop_category[] IS NULL AND cardinality($${customParam}::text[]) = 0)
    OR ${alias}.shop_categories && COALESCE($${fixedParam}::business_shop_category[], '{}')
    OR EXISTS (
      SELECT 1 FROM unnest(string_to_array(COALESCE(${alias}.other_category_description, ''), ',')) AS have(name),
                    unnest($${customParam}::text[]) AS want(name)
      WHERE lower(trim(have.name)) = lower(trim(want.name))
    ))`;
}
