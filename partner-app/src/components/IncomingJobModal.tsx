import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { IncomingRequestScreen } from './IncomingRequestScreen';
import { useAcceptBookingOffer, useBookingOffers, useDeclineBookingOffer } from '@/hooks/useBookingOffers';
import { usePendingOfferStore } from '@/state/pendingOfferStore';
import { useIncomingStore } from '@/state/incomingStore';
import { openJob } from '@/state/jobFocusStore';
import { showToast } from '@/state/toastStore';
import { ApiError } from '@/services/apiClient';
import { PendingOffer } from '@/services/bookingOffersService';
import { formatDistance } from '@/utils/formatDistance';
import { jobQueryKey } from '@/hooks/useJobs';
import { jobsService } from '@/services/jobsService';

// Lets the job screen finish fading in on top before this one closes underneath it.
const MODAL_HANDOFF_MS = 350;

/**
 * The Rapido/Uber-driver-style "incoming job" takeover (IncomingRequestScreen), mounted ONCE at
 * the app root (`App.tsx`) so it can open over whatever screen the worker is on.
 *
 * It opens for a new Quick Book offer two ways, whichever comes first:
 *  - a push while the app is open (`usePushNotifications.ts` sets the focused offer), or a tap
 *    on the notification;
 *  - the offer list itself (polled every few seconds): IncomingRequestsHub opens it for an
 *    offer not seen before, so it's reliable even when the push is late or dropped. When more
 *    than one request is new at once the hub shows them together in one list instead.
 */
export function IncomingJobModal() {
  const { t } = useTranslation();
  const { data: offers, refetch: refetchOffers } = useBookingOffers();
  const acceptMutation = useAcceptBookingOffer();
  const queryClient = useQueryClient();
  const [handingOff, setHandingOff] = useState(false);
  const declineMutation = useDeclineBookingOffer();

  const focusedBookingRequestId = usePendingOfferStore((state) => state.focusedBookingRequestId);
  const clearFocusedOffer = usePendingOfferStore((state) => state.clearFocusedOffer);
  const listOpen = useIncomingStore((state) => state.listOpen);
  const visible = focusedBookingRequestId !== null && !listOpen;
  const liveOffer = offers?.find((item) => item.bookingRequestId === focusedBookingRequestId) ?? null;
  // Accepting takes the offer out of the list (it's no longer an open offer, it's this
  // worker's job) while the job screen is still loading — keep showing the offer the worker
  // accepted instead of flashing "no longer available" for that moment.
  const lastOfferRef = useRef<PendingOffer | null>(liveOffer);
  if (liveOffer) lastOfferRef.current = liveOffer;
  const accepting = acceptMutation.isPending || acceptMutation.isSuccess || handingOff;
  const offer =
    liveOffer ?? (accepting && lastOfferRef.current?.bookingRequestId === focusedBookingRequestId ? lastOfferRef.current : null);

  // The push opens this screen instantly, but the offer list is only polled every few
  // seconds — so a brand-new offer usually isn't in the cached list yet. Fetch right away
  // whenever a new offer is focused. "Offer gone" is only decided once *that* fetch settles,
  // never from the stale pre-push list.
  const [checkedForId, setCheckedForId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusedBookingRequestId) {
      setCheckedForId(null);
      return;
    }
    let cancelled = false;
    refetchOffers().finally(() => {
      if (!cancelled) setCheckedForId(focusedBookingRequestId);
    });
    return () => {
      cancelled = true;
    };
  }, [focusedBookingRequestId, refetchOffers]);

  useEffect(() => {
    if (!visible) {
      acceptMutation.reset();
      declineMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on visibility changes
  }, [visible]);

  const handleAccept = () => {
    if (!offer) return;
    acceptMutation.mutate(offer.bookingRequestId, {
      onSuccess: async () => {
        const id = offer.bookingRequestId;
        Notifications.dismissNotificationAsync(id).catch(() => {});
        // The job screen is the first thing the worker sees: load the job while Accept is
        // still spinning (so it opens with the map and customer, not a spinner), open it on
        // top, and only then close this screen underneath — opening and closing two native
        // modals in the same instant could leave the wrong one showing on Android.
        setHandingOff(true);
        await queryClient.prefetchQuery({ queryKey: jobQueryKey(id), queryFn: () => jobsService.get(id) }).catch(() => {});
        openJob(id);
        showToast({ variant: 'success', title: t('bookings.acceptedToastTitle'), message: t('bookings.acceptedToastMessage') });
        setTimeout(() => {
          clearFocusedOffer();
          setHandingOff(false);
        }, MODAL_HANDOFF_MS);
      },
      onError: (err) => {
        const alreadyTaken = err instanceof ApiError && err.code === 'BOOKING_ALREADY_TAKEN';
        showToast({
          variant: alreadyTaken ? 'info' : 'error',
          title: t(alreadyTaken ? 'bookings.takenToastTitle' : 'common.errorTitle'),
          message: alreadyTaken ? t('bookings.takenToastMessage') : getLocalizedErrorMessage(err, t),
        });
        if (alreadyTaken) {
          Notifications.dismissNotificationAsync(offer.bookingRequestId).catch(() => {});
          clearFocusedOffer();
        }
      },
    });
  };

  const handleDecline = () => {
    if (!offer) {
      clearFocusedOffer();
      return;
    }
    const bookingRequestId = offer.bookingRequestId;
    declineMutation.mutate(bookingRequestId, {
      onSuccess: () => showToast({ variant: 'info', title: t('bookings.declinedToastTitle') }),
      onError: () => showToast({ variant: 'error', title: t('common.errorTitle'), message: t('errors.generic') }),
      onSettled: () => {
        Notifications.dismissNotificationAsync(bookingRequestId).catch(() => {});
        clearFocusedOffer();
      },
    });
  };

  const notFound = !offer && !accepting && checkedForId === focusedBookingRequestId && focusedBookingRequestId !== null;

  // The worker already tapped Accept on the notification: accept as soon as the offer is
  // loaded (once per offer), showing Accept as spinning the whole time.
  const autoAccept = usePendingOfferStore((state) => state.autoAccept);
  const autoAcceptedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoAccept || !offer || autoAcceptedIdRef.current === offer.bookingRequestId) return;
    autoAcceptedIdRef.current = offer.bookingRequestId;
    handleAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per auto-accepted offer
  }, [autoAccept, offer]);
  const autoAccepting = autoAccept && !notFound && !acceptMutation.isError;

  const busy = accepting || declineMutation.isPending || autoAccepting;
  useEffect(() => {
    useIncomingStore.getState().setJobBusy(busy);
  }, [busy]);

  return (
    <IncomingRequestScreen
      visible={visible}
      // Back just closes it: the request stays in Bookings → Requests. Only Decline declines.
      onRequestClose={() => !busy && clearFocusedOffer()}
      // A customer who picked this worker in particular: say so, it's not a broadcast.
      kicker={t(offer?.direct ? 'bookings.directKicker' : 'bookings.newJobKicker')}
      icon={offer?.direct ? 'user-check' : 'bolt'}
      state={notFound ? 'gone' : offer ? 'ready' : 'loading'}
      goneTitle={t('bookings.offerGoneTitle')}
      goneMessage={t('bookings.offerGoneMessage')}
      headline={offer ? t('bookings.distanceAway', { distance: formatDistance(offer.distanceMeters) }) : undefined}
      personName={offer?.customerFullName}
      personLine={offer?.locationAddress}
      chips={(offer?.skillCategories ?? []).map((key) => ({
        icon: 'screwdriver-wrench' as const,
        label: t(`workerProfile.skills.${key}`),
      }))}
      decline={{
        label: t(notFound ? 'common.close' : 'bookings.decline'),
        icon: 'xmark',
        onPress: handleDecline,
        loading: declineMutation.isPending,
        disabled: busy,
        dimmed: accepting || autoAccepting,
      }}
      accept={{
        label: t('bookings.accept'),
        icon: 'check',
        onPress: handleAccept,
        loading: accepting || autoAccepting,
        disabled: busy || !offer || notFound,
      }}
    />
  );
}
