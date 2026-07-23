import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from './GradientHeader';
import { SideDockMenu, SideDockItem } from './SideDockMenu';
import { colors } from '@/theme';
import { showToast } from '@/state/toastStore';

interface ServicesHeaderProps {
  title: string;
  subtitle?: string;
}

const MENU_ITEMS: SideDockItem[] = [
  { key: 'filters', icon: 'filter', label: 'services.menuFilters' },
  { key: 'sort', icon: 'arrow-up-wide-short', label: 'services.menuSort' },
  { key: 'favorites', icon: 'star', label: 'services.menuFavorites' },
  { key: 'history', icon: 'clock-rotate-left', label: 'services.menuHistory' },
];

/** Services' header carries a plain menu action (matching Home's pattern) — the Worker profile's own edit entry point now lives in a card at the top of the screen body instead, since the header pill only appeared once the profile query resolved, which read as a UI glitch. */
export function ServicesHeader({ title, subtitle }: ServicesHeaderProps) {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <GradientHeader
        title={title}
        subtitle={subtitle}
        leadingIcon="screwdriver-wrench"
        actions={[{ icon: 'bars', accessibilityLabel: t('services.menu'), onPress: () => setMenuVisible(true) }]}
      />
      <SideDockMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        accentColor={colors.primary}
        items={MENU_ITEMS.map((item) => ({ ...item, label: t(item.label) }))}
        onSelectItem={(item) => {
          setMenuVisible(false);
          showToast({ variant: 'info', title: item.label, message: t('common.comingSoonMessage') });
        }}
      />
    </>
  );
}
