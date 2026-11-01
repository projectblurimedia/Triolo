type Translate = (key: string) => string;

/** A partner's own kinds ("Fancy, Medicals"), stored together in one comma-separated text. */
export function customKinds(description: string | null | undefined): string[] {
  return (description ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * What a shop sells, as labels: the fixed kinds translated, then the shop's own kinds. The fixed
 * key 'other' only marks that own kinds exist, so it never shows by itself (a shop of only its
 * own kind — "Fancy" — would otherwise show nothing).
 */
export function shopKindLabels(t: Translate, shop: { shopCategories: string[]; otherCategoryDescription?: string | null }): string[] {
  return [
    ...shop.shopCategories.filter((key) => key !== 'other').map((key) => t(`businessProfile.categories.${key}`)),
    ...customKinds(shop.otherCategoryDescription),
  ];
}

/** The same for a worker's skills. */
export function workerKindLabels(t: Translate, worker: { skillCategories: string[]; otherSkillDescription?: string | null }): string[] {
  return [
    ...worker.skillCategories.filter((key) => key !== 'other').map((key) => t(`workerProfile.skills.${key}`)),
    ...customKinds(worker.otherSkillDescription),
  ];
}

/**
 * The partners' own kinds among a list, grouped case-insensitively under their first spelling,
 * most partners first — so "Fancy" shops get their own row next to the fixed kinds.
 */
export function customKindGroups<T>(items: T[], descriptionOf: (item: T) => string | null | undefined): { name: string; items: T[] }[] {
  const groups = new Map<string, { name: string; items: T[] }>();
  for (const item of items) {
    for (const name of customKinds(descriptionOf(item))) {
      const key = name.toLowerCase();
      const group = groups.get(key) ?? { name, items: [] };
      if (!group.items.includes(item)) group.items.push(item);
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}
