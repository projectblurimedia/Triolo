import { TFunction } from 'i18next';

interface BookingLike {
  status: string;
  directWorker?: { fullName: string } | null;
}

/**
 * A booking's status title: a booking sent to one worker in particular says so ("Request sent
 * to Ravi") instead of Quick Book's "Finding a Worker" while it waits for them.
 */
export function bookingStatusTitle(booking: BookingLike, t: TFunction): string {
  if (booking.status === 'broadcasting' && booking.directWorker) {
    return t('directBook.sentTitle', { name: booking.directWorker.fullName });
  }
  // Booked personally: nobody was "found" — the chosen worker said yes.
  if (booking.status === 'accepted' && booking.directWorker) {
    return t('directBook.acceptedTitle', { name: booking.directWorker.fullName });
  }
  return t(`tracking.status.${booking.status}.title`);
}

export function bookingStatusMessage(booking: BookingLike, t: TFunction, name: string): string {
  if (booking.status === 'broadcasting' && booking.directWorker) {
    return t('directBook.waitingMessage', { name: booking.directWorker.fullName });
  }
  return t(`tracking.status.${booking.status}.message`, { name });
}
