import { apiClient } from './apiClient';
import type { Page } from './adminApi';

export type AdStatus = 'scheduled' | 'running' | 'ended' | 'deleted';
export type AdPaymentMethod = 'cash' | 'upi' | 'other';
export type AdPlanDays = 1 | 3 | 7 | 30;
export type AdOrientation = 'vertical' | 'horizontal';
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
  latitude: number | null;
  longitude: number | null;
  /** Shown only to people within this distance of the place. */
  radiusKm: number;
  planDays: AdPlanDays;
  amount: number;
  paymentMethod: AdPaymentMethod;
  /** YYYY-MM-DD, India date. */
  startDate: string;
  endDate: string;
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
  advertiserName: string;
  advertiserPhone: string;
  title?: string;
  description?: string;
  orientation: AdOrientation;
  displaySeconds: number;
  latitude: number;
  longitude: number;
  locationText: string;
  linkUrl: string;
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
  /** Sets the ad's one image or one video; the server deletes what it no longer uses. */
  setMedia: (id: string, imageUrl: string | null, videoUrl: string | null) =>
    apiClient.put<Ad>(`/admin/ads/${id}/media`, { imageUrl, videoUrl }, true),
};

export const AD_MAX_VIDEO_SECONDS = 30;
export const AD_MAX_IMAGE_MB = 10;
/** Cloudinary takes videos up to 100 MB; bigger ones are fine when the browser can shrink them first. */
export const AD_MAX_VIDEO_MB = 100;
export const AD_MAX_VIDEO_MB_SHRINKABLE = 500;

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

/**
 * Uploads one file straight from the browser to Cloudinary, with a signed permission from our
 * server (videos are far over the server's 4.5 MB request limit). Resolves to the file's URL (and a video's length).
 */
export async function uploadAdFile(
  file: File,
  kind: 'image' | 'video',
  onProgress?: (share: number, sentBytes: number, totalBytes: number) => void,
): Promise<{ url: string; seconds: number | null }> {
  const signed = await apiClient.post<SignedUpload>('/admin/ads/upload-signature', { kind }, true);
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('folder', signed.folder);
  for (const [key, value] of Object.entries(signed.extra ?? {})) form.append(key, value);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total, event.loaded, event.total);
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as { secure_url?: string; duration?: number; error?: { message?: string } };
        // A video's real length, as Cloudinary measured it.
        if (xhr.status < 300 && body.secure_url) resolve({ url: body.secure_url, seconds: body.duration ?? null });
        else reject(new Error(body.error?.message ?? 'Upload failed'));
      } catch {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed — check the internet connection.'));
    xhr.send(form);
  });
}
