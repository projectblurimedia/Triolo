import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from './GradientHeader';
import { ServicesMenuDrawer } from './ServicesMenuDrawer';

interface ServicesHeaderProps {
  title: string;
  subtitle?: string;
}

/** Services' header carries a menu action opening the full `ServicesMenuDrawer` (matching Home's own drawer pattern) — the Worker profile's own edit entry point lives in a card at the top of the screen body instead, since a header pill only appeared once the profile query resolved, which read as a UI glitch. */
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
      <ServicesMenuDrawer visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </>
  );
}
