/** The fixed worker skills (labels: `workerProfile.skills.<key>`). "other" is typed by the worker. */
export const SKILL_CATEGORIES = [
  { key: 'electrician', icon: 'bolt' as const },
  { key: 'plumber', icon: 'faucet' as const },
  { key: 'painter', icon: 'paint-roller' as const },
  { key: 'carpenter', icon: 'hammer' as const },
  { key: 'mechanic', icon: 'wrench' as const },
  { key: 'cleaner', icon: 'broom' as const },
  { key: 'mason', icon: 'trowel' as const },
];

/** The fixed shop categories (labels: `businessProfile.categories.<key>`). */
export const SHOP_CATEGORIES = [
  { key: 'grocery', icon: 'basket-shopping' as const },
  { key: 'restaurant', icon: 'utensils' as const },
  { key: 'pharmacy', icon: 'pills' as const },
  { key: 'electronics', icon: 'tv' as const },
  { key: 'clothing', icon: 'shirt' as const },
  { key: 'hardware', icon: 'screwdriver-wrench' as const },
  { key: 'salon', icon: 'scissors' as const },
];
