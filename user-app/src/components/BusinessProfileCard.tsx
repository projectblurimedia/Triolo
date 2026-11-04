import React from 'react';
import { useTranslation } from 'react-i18next';
import { MyCapabilityCard, ratingStats } from './MyCapabilityCard';
import { BusinessProfile } from '@/services/businessesService';
import { formatAddress } from '@/utils/formatAddress';
import { shopKindLabels } from '@/utils/kindLabels';

/** The account's own shop (Bazaar tab, Profile) — rating, rated orders and delivery inside the card. */
export function BusinessProfileCard({ profile }: { profile: BusinessProfile }) {
  const { t } = useTranslation();
  return (
    <MyCapabilityCard
      icon="store"
      title={profile.shopName}
      photoUrl={profile.profilePhotoUrl}
      verificationStatus={profile.verificationStatus}
      kinds={shopKindLabels(t, profile)}
      place={formatAddress(profile)}
      stats={ratingStats(t, profile.ratingAverage, profile.ratingCount, t('profile.ratedOrders'), {
        icon: profile.deliveryAvailable ? 'truck' : 'store',
        value:
          profile.deliveryAvailable && profile.deliveryPricePerKm != null
            ? `₹${profile.deliveryPricePerKm}/km`
            : t(profile.deliveryAvailable ? 'home.delivery' : 'home.pickup'),
        label: t('profile.statDelivery'),
        tint: '#0EA5E9',
      })}
      note={t('profile.manageShopInPartnerApp')}
    />
  );
}
