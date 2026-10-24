import { WORKER_SKILL_CATEGORIES } from '@/modules/workers/interfaces';

const FIXED = new Set<string>(WORKER_SKILL_CATEGORIES);
const MAX_CUSTOM = 5;

/**
 * The apps send one skills list: fixed skill keys, plus the names of partner-made skills
 * (what a worker typed under "other"). Split them here: the fixed ones are the enum column, the
 * names go to `custom_skills` (and need 'other', which every such worker has).
 */
export function splitSkills(input: string[]): { fixed: string[]; custom: string[] } {
  const fixed: string[] = [];
  const custom: string[] = [];
  for (const raw of input) {
    const value = raw.trim();
    if (FIXED.has(value)) {
      if (!fixed.includes(value)) fixed.push(value);
      continue;
    }
    // Dots and colons would read as i18n key separators where the apps show skill names.
    const name = value.replace(/[.:]/g, '').replace(/\s+/g, ' ').trim();
    if (name && !custom.some((entry) => entry.toLowerCase() === name.toLowerCase()) && custom.length < MAX_CUSTOM) {
      custom.push(name);
    }
  }
  if (custom.length > 0 && !fixed.includes('other')) fixed.push('other');
  return { fixed, custom };
}

/** What a booking shows: its fixed skills, with the custom names standing in for "other". */
export function displaySkills(fixed: string[], custom: string[]): string[] {
  return custom.length > 0 ? [...fixed.filter((key) => key !== 'other'), ...custom] : fixed;
}
