import type { AccountStatus, BookingStatus, OrderStatus, ProblemStatus, Verification } from '@/services/adminApi';

export type Tone = 'success' | 'warning' | 'error' | 'pending' | 'info' | 'muted' | 'purple';

const SKILLS: Record<string, string> = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  painter: 'Painter',
  carpenter: 'Carpenter',
  mechanic: 'Mechanic',
  cleaner: 'Cleaner',
  mason: 'Mason',
  other: 'Other',
};

const SHOP_CATEGORIES: Record<string, string> = {
  grocery: 'Grocery',
  restaurant: 'Restaurant',
  pharmacy: 'Pharmacy',
  electronics: 'Electronics',
  clothing: 'Clothing',
  hardware: 'Hardware',
  salon: 'Salon',
  other: 'Other',
};

const JOB_CATEGORIES: Record<string, string> = {
  teacher: 'Teacher / Tutor',
  cook: 'Cook',
  housekeeper: 'Housekeeper',
  nanny: 'Nanny / Babysitter',
  elder_care: 'Elder care',
  driver: 'Driver',
  security_guard: 'Security guard',
  gardener: 'Gardener',
  office_assistant: 'Office assistant',
  shop_assistant: 'Shop assistant',
  other: 'Other',
};

export const skillLabel = (key: string) => SKILLS[key] ?? key;
export const skillsLabel = (keys: string[]) => keys.map(skillLabel).join(', ');
export const shopCategoryLabel = (key: string) => SHOP_CATEGORIES[key] ?? key;
export const jobCategoryLabel = (key: string) => JOB_CATEGORIES[key] ?? key;

export const AVAILABILITY: Record<string, string> = { full_time: 'Full time', part_time: 'Part time', live_in: 'Live-in' };

export function initials(name: string | null | undefined): string {
  return (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "5 min ago", "3 h ago", "2 days ago", then the date. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

export const rupees = (amount: number | null | undefined) =>
  amount == null ? '—' : `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const distance = (meters: number | null | undefined) =>
  meters == null ? '—' : meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;

/** A worker's or shop's location as shown everywhere: only the place name (village / town). */
export function formatAddress(parts: { locationName?: string | null; city?: string | null }): string {
  return parts.locationName || parts.city || '—';
}

export function accountStatus(status: AccountStatus, until?: string | null): { label: string; tone: Tone } {
  if (status === 'blocked') return { label: 'Banned', tone: 'error' };
  if (status === 'suspended') return { label: until ? `Suspended till ${formatDate(until)}` : 'Suspended', tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}

export function verificationStatus(status: Verification): { label: string; tone: Tone } {
  if (status === 'verified') return { label: 'Verified', tone: 'success' };
  if (status === 'rejected') return { label: 'Rejected', tone: 'error' };
  return { label: 'Pending review', tone: 'pending' };
}

const BOOKING: Record<BookingStatus, { label: string; tone: Tone }> = {
  broadcasting: { label: 'Finding worker', tone: 'pending' },
  accepted: { label: 'Accepted', tone: 'pending' },
  on_the_way: { label: 'On the way', tone: 'pending' },
  arrived: { label: 'Arrived', tone: 'pending' },
  in_progress: { label: 'Work in progress', tone: 'pending' },
  work_done: { label: 'Waiting for customer', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'error' },
  expired: { label: 'No worker found', tone: 'muted' },
};
export const bookingStatus = (status: BookingStatus) => BOOKING[status] ?? { label: status, tone: 'muted' as Tone };
export const BOOKING_ACTIVE: BookingStatus[] = ['broadcasting', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'work_done'];

const ORDER: Record<OrderStatus, { label: string; tone: Tone }> = {
  placed: { label: 'New — waiting for shop', tone: 'pending' },
  accepted: { label: 'Accepted', tone: 'pending' },
  preparing: { label: 'Packing', tone: 'pending' },
  packed: { label: 'Bill sent', tone: 'pending' },
  ready_for_pickup: { label: 'Ready for pickup', tone: 'pending' },
  out_for_delivery: { label: 'Out for delivery', tone: 'pending' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'error' },
  declined: { label: 'Declined by shop', tone: 'muted' },
  expired: { label: 'Expired', tone: 'muted' },
};
export const orderStatus = (status: OrderStatus) => ORDER[status] ?? { label: status, tone: 'muted' as Tone };
export const ORDER_ACTIVE: OrderStatus[] = ['placed', 'accepted', 'preparing', 'packed', 'ready_for_pickup', 'out_for_delivery'];

const PROBLEM: Record<ProblemStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open — waiting for worker', tone: 'pending' },
  accepted: { label: 'In progress', tone: 'pending' },
  work_done: { label: 'Work done', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  closed: { label: 'Closed by admin', tone: 'muted' },
};
export const problemStatus = (status: ProblemStatus) => PROBLEM[status] ?? { label: status, tone: 'muted' as Tone };

export const cancelledByLabel = (by: string | null | undefined) =>
  by === 'admin'
    ? 'Triolo admin'
    : by === 'worker'
      ? 'the worker'
      : by === 'shop'
        ? 'the shop'
        : by === 'customer'
          ? 'the customer'
          : 'someone';

export const stars = (rating: number | null | undefined) => (rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '');
