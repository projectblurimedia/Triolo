import { apiClient } from './apiClient';
import type { Page } from './adminApi';

/** in_review / rejected: booked by a business on the Triolo Ads website, not approved (yet). */
export type AdStatus = 'unpaid' | 'in_review' | 'rejected' | 'scheduled' | 'running' | 'ended' | 'deleted';
/** 'pending' = not paid yet (a business's own booking, until you record how it was paid). */
/** 'online' = paid by the business through Razorpay on the Triolo Ads website. */
export type AdPaymentMethod = 'cash' | 'upi' | 'other' | 'pending' | 'online';
export type AdPlanDays = 1 | 3 | 7 | 30;
export type AdOrientation = 'vertical' | 'horizontal';
export type { AdActionType, AdPromotedKind } from '@/components/AdActionField';
import type { AdActionType, AdPromotedKind } from '@/components/AdActionField';
export type AdPlanPrices = Record<'1' | '3' | '7' | '30', number>;

export interface AdSettings {
  adsEnabled: boolean;
  launchUser: boolean;
  launchPartner: boolean;
  /** Before key actions: customer app quick actions; partner app work done / order finished. */
  actionUser: boolean;
  actionPartner: boolean;
  /** ₹ per plan, keyed "1" / "3" / "7" / "30". New bookings only — booked ads keep their amount. */
  prices: AdPlanPrices;
  updatedAt: string;
}

export interface Ad {
  id: string;
  billNumber: number;
  advertiserName: string;
  advertiserPhone: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  /** Up to 4 images (a carousel in the apps, after the video). */
  imageUrls: string[];
  /** One video (an ad has an image or a video, never both). */
  videoUrl: string | null;
  /** Vertical (reel, 9:16) or horizontal (16:9). */
  orientation: AdOrientation;
  /** An image shows for this many seconds before it can be closed. */
  displaySeconds: number;
  /** A video's length in seconds (at most 30). */
  videoSeconds: number | null;
  /** How long the apps show it before it can be closed. */
  durationSeconds: number;
  /** The place name shown under the ad. */
  locationText: string | null;
  /** Opened when the video or a picture is tapped in the apps. */
  linkUrl: string | null;
  /** What tapping the ad does. */
  actionType: AdActionType;
  /** For 'location': where directions go. */
  destination: { latitude: number; longitude: number; name: string } | null;
  /** For 'service' / 'business' / 'job_post': the promoted profile. */
  promoted: { kind: AdPromotedKind; id: string; name: string } | null;
  /** The phone number used to find the promoted profile. */
  promoteMobile: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Shown only to people within this distance of the place. */
  radiusKm: number;
  planDays: AdPlanDays;
  amount: number;
  paymentMethod: AdPaymentMethod;
  razorpayPaymentId?: string | null;
  paidAt?: string | null;
  /** The Razorpay refund of a rejected / withdrawn online payment. */
  refundId?: string | null;
  refundedAt?: string | null;
  /** YYYY-MM-DD, India date. */
  startDate: string;
  endDate: string;
  /** The business account that booked it on the Triolo Ads website; null when you did. */
  ownerAccountId: string | null;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  /** Why it was rejected (the business sees it). */
  reviewNote: string | null;
  reviewedAt: string | null;
  impressions: number;
  clicks: number;
  status: AdStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdOverview {
  settings: AdSettings;
  counts: Record<AdStatus, number>;
  revenueTotal: number;
  revenueThisMonth: number;
  prices: AdPlanPrices;
  radiusKm: number;
}

export interface SaveAd {
  /** The ad's image or video, already uploaded; saved together with the ad. */
  imageUrl?: string | null;
  videoUrl?: string | null;
  /** Left out when promoting a Triolo Partner profile (its name is used). */
  advertiserName?: string;
  advertiserPhone: string;
  title?: string;
  description?: string;
  orientation: AdOrientation;
  displaySeconds: number;
  linkUrl: string;
  actionType: AdActionType;
  actionLatitude: number | null;
  actionLongitude: number | null;
  actionPlace: string | null;
  promoteMobile?: string;
  planDays: AdPlanDays;
  paymentMethod: AdPaymentMethod;
  startDate: string;
}

/** The plans on offer; their prices are the admin's (`AdSettings.prices`). */
export const AD_PLANS: { days: AdPlanDays; key: keyof AdPlanPrices; label: string }[] = [
  { days: 1, key: '1', label: '1 day' },
  { days: 3, key: '3', label: '3 days' },
  { days: 7, key: '7', label: '1 week' },
  { days: 30, key: '30', label: '1 month' },
];

export const planLabel = (days: number) => AD_PLANS.find((plan) => plan.days === days)?.label ?? `${days} days`;

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const adsApi = {
  overview: () => apiClient.get<AdOverview>('/admin/ads/overview', true),
  saveSettings: (changes: Partial<Omit<AdSettings, 'updatedAt'>>) =>
    apiClient.patch<AdSettings>('/admin/ads/settings', changes, true),
  list: (params: { status?: string; q?: string; page?: number; limit?: number }) =>
    apiClient.get<Page<Ad>>(`/admin/ads${qs(params)}`, true),
  get: (id: string) => apiClient.get<Ad>(`/admin/ads/${id}`, true),
  create: (body: SaveAd) => apiClient.post<Ad>('/admin/ads', body, true),
  update: (id: string, body: SaveAd) => apiClient.put<Ad>(`/admin/ads/${id}`, body, true),
  remove: (id: string) => apiClient.delete<Ad>(`/admin/ads/${id}`, true),
  /** Approve a business's own ad (it then runs from its start date) or reject it with a reason. */
  review: (id: string, decision: 'approve' | 'reject', note?: string) =>
    apiClient.post<Ad>(`/admin/ads/${id}/review`, { decision, note: note || undefined }, true),
  /** Sets the ad's one image or one video; the server deletes what it no longer uses. */
  setMedia: (id: string, imageUrl: string | null, videoUrl: string | null) =>
    apiClient.put<Ad>(`/admin/ads/${id}/media`, { imageUrl, videoUrl }, true),
};

export const AD_MAX_VIDEO_SECONDS = 30;
export const AD_MAX_IMAGE_MB = 10;
/** Cloudinary takes videos up to 100 MB. */
export const AD_MAX_VIDEO_MB = 100;

interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: 'image' | 'video';
  /** Extra signed fields to send as-is (videos: Cloudinary prepares the phone copy right away). */
  extra?: Record<string, string>;
}

// Big files go up in pieces: each piece is retried on its own if the line drops, so a weak
// connection can't break or restart the whole upload. Cloudinary joins them into the exact
// original file (pieces must be at least 5 MB, except the last).
const CHUNK_BYTES = 6 * 1024 * 1024;
const CHUNK_TRIES = 4;

type CloudinaryResult = { secure_url?: string; duration?: number; done?: boolean; error?: { message?: string } };

function sendPart(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onSent: (loaded: number) => void,
): Promise<CloudinaryResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => onSent(event.loaded);
    xhr.onload = () => {
      let body: CloudinaryResult = {};
      try {
        body = JSON.parse(xhr.responseText) as CloudinaryResult;
      } catch {
        // Not JSON — treated as a failure below.
      }
      if (xhr.status < 300) resolve(body);
      else reject(Object.assign(new Error(body.error?.message ?? 'Upload failed'), { retryable: xhr.status >= 500 }));
    };
    xhr.onerror = () => reject(Object.assign(new Error('Upload failed — check the internet connection.'), { retryable: true }));
    xhr.send(form);
  });
}

/**
 * Uploads one file straight from the browser to Cloudinary, exactly as it is (never re-encoded
 * here — Cloudinary makes the phone copy from the original), with a signed permission from our
 * server (videos are far over the server's 4.5 MB request limit). Resolves to the file's URL
 * (and a video's length, as Cloudinary measured it).
 */
export async function uploadAdFile(
  file: File,
  kind: 'image' | 'video',
  onProgress?: (share: number, sentBytes: number, totalBytes: number) => void,
): Promise<{ url: string; seconds: number | null }> {
  const signed = await apiClient.post<SignedUpload>('/admin/ads/upload-signature', { kind }, true);
  const endpoint = `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`;
  const formFor = (part: Blob) => {
    const form = new FormData();
    form.append('file', part, file.name);
    form.append('api_key', signed.apiKey);
    form.append('timestamp', String(signed.timestamp));
    form.append('signature', signed.signature);
    form.append('folder', signed.folder);
    for (const [key, value] of Object.entries(signed.extra ?? {})) form.append(key, value);
    return form;
  };
  const total = file.size;
  const report = (sent: number) => onProgress?.(Math.min(1, sent / total), Math.min(sent, total), total);
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let result: CloudinaryResult = {};

  for (let start = 0; start < total || start === 0; start += CHUNK_BYTES) {
    const end = Math.min(start + CHUNK_BYTES, total);
    const headers: Record<string, string> =
      total > CHUNK_BYTES ? { 'X-Unique-Upload-Id': uploadId, 'Content-Range': `bytes ${start}-${end - 1}/${total}` } : {};
    for (let attempt = 1; ; attempt += 1) {
      try {
        result = await sendPart(endpoint, formFor(file.slice(start, end)), headers, (loaded) =>
          report(start + Math.min(loaded, end - start)),
        );
        break;
      } catch (err) {
        if (attempt >= CHUNK_TRIES || !(err as { retryable?: boolean }).retryable) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
    report(end);
    if (end >= total) break;
  }
  if (!result.secure_url) throw new Error(result.error?.message ?? 'Upload failed');
  return { url: result.secure_url, seconds: result.duration ?? null };
}
