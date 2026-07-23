import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader, HeaderAction } from './GradientHeader';
import { BusinessProfileModal } from './BusinessProfileModal';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';

interface BazaarHeaderProps {
  title: string;
  subtitle?: string;
}

/** Bazaar's header carries an edit action for the account's Business profile, shown only once one exists — creation itself still happens from Home's menu. */
export function BazaarHeader({ title, subtitle }: BazaarHeaderProps) {
  const { t } = useTranslation();
  const { data: businessProfile } = useMyBusinessProfile();
  const [editVisible, setEditVisible] = useState(false);

  const actions: HeaderAction[] = businessProfile
    ? [
        {
          icon: 'store',
          label: t('bazaar.myBusiness'),
          accessibilityLabel: t('bazaar.editBusinessProfile'),
          onPress: () => setEditVisible(true),
        },
      ]
    : [];

  return (
    <>
      <GradientHeader title={title} subtitle={subtitle} leadingIcon="store" actions={actions} />
      <BusinessProfileModal visible={editVisible} onClose={() => setEditVisible(false)} profile={businessProfile} />
    </>
  );
}
