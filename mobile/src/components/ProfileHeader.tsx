import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from './GradientHeader';
import { ProfileMenuModal } from './ProfileMenuModal';

interface ProfileHeaderProps {
  title: string;
  subtitle?: string;
}

/** Profile's header carries a menu (not the shared per-tab header) — language/theme/logout live in the modal it opens. */
export function ProfileHeader({ title, subtitle }: ProfileHeaderProps) {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <GradientHeader
        title={title}
        subtitle={subtitle}
        leadingIcon="user"
        actions={[{ icon: 'ellipsis-vertical', accessibilityLabel: t('profile.menuTitle'), onPress: () => setMenuVisible(true) }]}
      />
      <ProfileMenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </>
  );
}
