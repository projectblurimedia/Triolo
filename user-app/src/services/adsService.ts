import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './apiClient';

/** Which app this is, so the admin's per-app switches apply. */
export const AD_APP = 'user' as const;

/** Ads are shown only before key actions now (`launch`, when the app opened, was removed). */
export type AdPlacement = 'launch' | 'action';

/** A local business's ad, as booked by the Triolo admin. */
/** A worker (Book Now), shop (Order from this Shop) or job post (Contact) an ad promotes. */
export interface AdPromoted {
  kind: 'service' | 'business' | 'job_post';
  id: string;
  name: string;
}

export interface AdPromotedCard {
  kind: AdPromoted['kind'];
  name: string;
  photoUrl: string | null;
  /** Skill (worker) or shop category codes. */
  tags: string[];
  customTags: string[];
  /** A job post's work, e.g. "Cook". */
  headline: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  experienceYears: number | null;
  deliveryAvailable: boolean | null;
  payAmount: number | null;
  payPeriod: 'daily' | 'monthly' | null;
  placeName: string | null;
}

export interface Ad {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  /** Up to 4 pictures, shown as a carousel after the video. */
  imageUrls: string[];
  /** One video, always played muted. */
  videoUrl: string | null;
  advertiserName: string;
  contactPhone: string | null;
  locationText: string | null;
  /** Opened when the video or a picture is tapped. */
  linkUrl: string | null;
  /** What tapping the ad does (older servers leave it out: then a link means 'link'). */
  actionType?: 'none' | 'link' | 'location' | 'service' | 'business' | 'job_post';
  /** For 'location': where Directions goes. */
  destination?: { latitude: number; longitude: number; name: string } | null;
  /** For 'service' / 'business' / 'job_post': the Triolo profile it promotes. */
  promoted?: AdPromoted | null;
  /** A profile ad's card (it has no picture or video): the promoted worker, shop or job post. */
  promotedCard?: AdPromotedCard | null;
  /** Vertical (reel / poster, 9:16) or horizontal (16:9). */
  orientation: 'vertical' | 'horizontal';
  /** Seconds it shows before it can be closed (an image's set time, or the video's length). */
  durationSeconds: number;
  /** Last day it runs, YYYY-MM-DD. */
  endDate: string;
}

const LAST_SEEN_KEY = 'triolo-last-ad';
let lastSeen: string | null | undefined;

// The ad this person saw last goes to the back of the queue on the server, so each banner
// shows a different business whenever more than one ad is running.
async function getLastSeen(): Promise<string | null> {
  if (lastSeen === undefined) {
    lastSeen = await AsyncStorage.getItem(LAST_SEEN_KEY).catch(() => null);
  }
  return lastSeen ?? null;
}

function setLastSeen(id: string) {
  lastSeen = id;
  AsyncStorage.setItem(LAST_SEEN_KEY, id).catch(() => {});
}

/** Which key action the ad comes before (the admin switches each one on or off). */
export type AdSpot = 'quick_book' | 'book_worker' | 'send_list' | 'post_problem' | 'hire_staff' | 'work_done' | 'order_pin';

export interface AdViewer {
  latitude: number;
  longitude: number;
}

async function serveNow(placement: AdPlacement, here: AdViewer, spot?: AdSpot): Promise<Ad | null> {
  const exclude = await getLastSeen();
  // Ads are local: the server shows only ads running near here.
  const params = new URLSearchParams({
    app: AD_APP,
    placement,
    latitude: String(here.latitude),
    longitude: String(here.longitude),
  });
  if (exclude) params.set('exclude', exclude);
  if (spot) params.set('spot', spot);
  const ad = await apiClient.get<Ad | null>(`/ads/serve?${params.toString()}`, true);
  if (ad) setLastSeen(ad.id);
  return ad;
}

// One request at a time, so the second banner (Home card or app-open) can skip the first one's ad.
let queue: Promise<unknown> = Promise.resolve();

export const adsService = {
  /** The ad to show now, or null when ads are off here or none is running nearby. */
  serve(placement: AdPlacement, here: AdViewer, spot?: AdSpot): Promise<Ad | null> {
    const run = queue.then(() => serveNow(placement, here, spot));
    queue = run.catch(() => null);
    return run;
  },

  /** Counts an open of the ad's details (fire and forget). */
  recordOpen(id: string): void {
    apiClient.post(`/ads/${id}/click`, undefined, true).catch(() => {});
  },
};
