import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from './GradientHeader';
import { BazaarMenuDrawer } from './BazaarMenuDrawer';

interface BazaarHeaderProps {
  title: string;
  subtitle?: string;
}

/** Bazaar's header carries a menu action opening the full `BazaarMenuDrawer` (matching Home's own drawer pattern) — the Business profile's own edit entry point lives in a card at the top of the screen body instead, since a header pill only appeared once the profile query resolved, which read as a UI glitch. Header and menu use the constant brand blue, matching every other tab (per earlier follow-up feedback) — Bazaar's orange identity stays only on BusinessProfileCard/BusinessProfileModal, not this tab's own chrome. */
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
      <BazaarMenuDrawer visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </>
  );
}
