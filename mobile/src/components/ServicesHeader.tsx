import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader, HeaderAction } from './GradientHeader';
import { WorkerProfileModal } from './WorkerProfileModal';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';

interface ServicesHeaderProps {
  title: string;
  subtitle?: string;
}

/** Services' header carries an edit action for the account's Worker profile, shown only once one exists — creation itself still happens from Home's menu. */
export function ServicesHeader({ title, subtitle }: ServicesHeaderProps) {
  const { t } = useTranslation();
  const { data: workerProfile } = useMyWorkerProfile();
  const [editVisible, setEditVisible] = useState(false);

  const actions: HeaderAction[] = workerProfile
    ? [
        {
          icon: 'screwdriver-wrench',
          label: t('services.myService'),
          accessibilityLabel: t('services.editWorkerProfile'),
          onPress: () => setEditVisible(true),
        },
      ]
    : [];

  return (
    <>
      <GradientHeader title={title} subtitle={subtitle} leadingIcon="screwdriver-wrench" actions={actions} />
      <WorkerProfileModal visible={editVisible} onClose={() => setEditVisible(false)} profile={workerProfile} />
    </>
  );
}
