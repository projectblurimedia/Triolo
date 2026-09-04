import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from './GradientHeader';
import { SideDockMenu, SideDockItem } from './SideDockMenu';
import { headerGradient } from '@/theme';
import { showToast } from '@/state/toastStore';

interface BazaarHeaderProps {
  title: string;
  subtitle?: string;
}

const MENU_ITEMS: SideDockItem[] = [
  { key: 'filters', icon: 'filter', label: 'bazaar.menuFilters' },
  { key: 'sort', icon: 'arrow-up-wide-short', label: 'bazaar.menuSort' },
  { key: 'favorites', icon: 'star', label: 'bazaar.menuFavorites' },
  { key: 'orders', icon: 'bag-shopping', label: 'bazaar.menuOrders' },
];

/** Bazaar's header carries a plain menu action (matching Home's pattern) — the Business profile's own edit entry point now lives in a card at the top of the screen body instead, since the header pill only appeared once the profile query resolved, which read as a UI glitch. Header and menu use the constant brand blue, matching every other tab (per follow-up feedback) — Bazaar's orange identity stays only on BusinessProfileCard/BusinessProfileModal, not this tab's own chrome. */
export function BazaarHeader({ title, subtitle }: BazaarHeaderProps) {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <GradientHeader
        title={title}
        subtitle={subtitle}
        leadingIcon="store"
        actions={[{ icon: 'bars', accessibilityLabel: t('bazaar.menu'), onPress: () => setMenuVisible(true) }]}
      />
      <SideDockMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        gradient={headerGradient}
        items={MENU_ITEMS.map((item) => ({ ...item, label: t(item.label) }))}
        onSelectItem={(item) => {
          setMenuVisible(false);
          showToast({ variant: 'info', title: item.label, message: t('common.comingSoonMessage') });
        }}
      />
    </>
  );
}
