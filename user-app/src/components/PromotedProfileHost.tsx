import React, { useEffect, useState } from 'react';
import i18n from '@/localization/i18n';
import { AdPromoted } from '@/services/adsService';
import { workersService, WorkerNearbyResult } from '@/services/workersService';
import { businessesService, BusinessNearbyResult } from '@/services/businessesService';
import { jobSeekersService, JobSeeker } from '@/services/jobSeekersService';
import { useLocationStore } from '@/state/locationStore';
import { showToast } from '@/state/toastStore';
import { endAdFreeFlow, setAdPromotionHandler } from './Ads';
import { BookWorkerModal } from './BookWorkerModal';
import { SendListModal } from './SendListModal';
import { ChooseListModal } from './ChooseListModal';
import { openNewList } from '@/navigation/navigationRef';
import { JobSeekerDetailModal } from './JobSeekerDetailModal';

/** Metres from the phone's last known position (0 when it isn't known yet). */
function metresFromHere(latitude: number | null, longitude: number | null): number {
  const { status, latitude: lat, longitude: lng } = useLocationStore.getState();
  if (status !== 'ready' || lat == null || lng == null || latitude == null || longitude == null) return 0;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const a =
    Math.sin(rad(latitude - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(latitude)) * Math.sin(rad(longitude - lng) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Mounted once at the root: an ad promoting a Triolo profile opens it here — Book Now (the
 * personal booking flow), Order from this Shop (send a list to that shop) or Contact (the job
 * seeker's details with Call). A profile no longer available says so.
 */
export function PromotedProfileHost() {
  const [worker, setWorker] = useState<WorkerNearbyResult | null>(null);
  const [shop, setShop] = useState<BusinessNearbyResult | null>(null);
  // The list picked for the shop (null while the list picker is open).
  const [listId, setListId] = useState<string | null>(null);
  const [person, setPerson] = useState<JobSeeker | null>(null);

  useEffect(() => {
    setAdPromotionHandler(
      async (promoted: AdPromoted) => {
        try {
          if (promoted.kind === 'service') {
            const profile = await workersService.getPublic(promoted.id);
            setWorker({ ...profile, distanceMeters: metresFromHere(profile.latitude, profile.longitude) });
          } else if (promoted.kind === 'business') {
            const profile = await businessesService.getPublic(promoted.id);
            setListId(null);
            setShop({ ...profile, distanceMeters: metresFromHere(profile.latitude, profile.longitude) });
          } else {
            const post = await jobSeekersService.getPublic(promoted.id);
            setPerson({ ...post, distanceMeters: metresFromHere(post.latitude, post.longitude) });
          }
        } catch {
          endAdFreeFlow();
          showToast({ variant: 'info', title: i18n.t('ads.profileGoneTitle'), message: i18n.t('ads.profileGoneMessage') });
        }
      },
      ['service', 'business', 'job_post'],
    );
    return () => setAdPromotionHandler(null);
  }, []);

  // Booking / ordering / contacting from an ad shows no ads until these screens are all closed.
  const flowOpen = !!worker || !!shop || !!person;
  useEffect(() => {
    if (!flowOpen) endAdFreeFlow();
  }, [flowOpen]);

  return (
    <>
      <BookWorkerModal worker={worker} onClose={() => setWorker(null)} onBooked={() => setTimeout(() => setWorker(null), 350)} />
      <ChooseListModal
        visible={!!shop && listId === null}
        shopName={shop?.shopName}
        onClose={() => setShop(null)}
        onPick={setListId}
        onCreate={() => {
          setShop(null);
          openNewList();
        }}
      />
      <SendListModal
        visible={!!shop && listId !== null}
        shop={shop}
        listId={listId}
        onClose={() => setShop(null)}
        onLeave={() => setShop(null)}
      />
      <JobSeekerDetailModal person={person} onClose={() => setPerson(null)} />
    </>
  );
}
