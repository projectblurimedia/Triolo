import React from 'react';
import { useTranslation } from 'react-i18next';
import { MyCapabilityCard, ratingStats } from './MyCapabilityCard';
import { WorkerProfile } from '@/services/workersService';
import { formatAddress } from '@/utils/formatAddress';
import { workerKindLabels } from '@/utils/kindLabels';

/** The account's own worker profile (Services tab, Profile) — rating and jobs inside the card. */
export function WorkerProfileCard({ profile }: { profile: WorkerProfile }) {
  const { t } = useTranslation();
  return (
    <MyCapabilityCard
      icon="screwdriver-wrench"
      title={t('services.myService')}
      photoUrl={profile.profilePhotoUrl}
      verificationStatus={profile.verificationStatus}
      kinds={workerKindLabels(t, profile)}
      place={formatAddress(profile)}
      stats={ratingStats(t, profile.ratingAverage, profile.ratingCount, t('workerReviews.statRatedJobs'), {
        icon: 'briefcase',
        value: t('services.experienceShort', { count: profile.experienceYears }),
        label: t('profile.statExperience'),
        tint: '#7C3AED',
      })}
      note={t('profile.manageWorkerInPartnerApp')}
    />
  );
}
