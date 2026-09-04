import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from './GradientHeader';
import { HomeMenuModal } from './HomeMenuModal';

interface HomeHeaderProps {
  title: string;
  subtitle?: string;
}

/** Home's header carries a menu (not the shared per-tab header) — Worker/Business entry points live in the drawer it opens. */
export function HomeHeader({ title, subtitle }: HomeHeaderProps) {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <GradientHeader
        title={title}
        subtitle={subtitle}
        leadingIcon="shapes"
        actions={[
          { icon: 'bell', accessibilityLabel: t('home.notifications') },
          { icon: 'bars', accessibilityLabel: t('home.menu'), onPress: () => setMenuVisible(true) },
        ]}
      />
      <HomeMenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </>
  );
}
