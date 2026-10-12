import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from './GradientHeader';
import { HomeMenuModal } from './HomeMenuModal';
import { NotificationsModal } from './NotificationsModal';
import { useNotifications } from '@/hooks/useNotifications';

interface HomeHeaderProps {
  title: string;
  subtitle?: string;
}

/** Home's header: the notifications bell (live unread badge) and the menu drawer. */
export function HomeHeader({ title, subtitle }: HomeHeaderProps) {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const { data: notifications } = useNotifications();

  return (
    <>
      <GradientHeader
        title={title}
        subtitle={subtitle}
        leadingIcon="shapes"
        actions={[
          {
            icon: 'bell',
            accessibilityLabel: t('home.notifications'),
            badgeCount: notifications?.unreadCount ?? 0,
            onPress: () => setNotificationsVisible(true),
          },
          { icon: 'bars', accessibilityLabel: t('home.menu'), onPress: () => setMenuVisible(true) },
        ]}
      />
      <HomeMenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
    </>
  );
}
