import { AppError } from '@/common/errors/AppError';
import {
  deletePhotosFromCloudinary,
  deleteVideosFromCloudinary,
  deleteCloudinaryIds,
  extractPublicIdFromUrl,
  isOwnCloudinaryUrl,
  listCloudinaryFiles,
  playbackUrl,
  signDirectUpload,
  videoDurationSeconds,
  SignedUpload,
} from '@/common/services/cloudinaryService';
import { logger } from '@/common/utils/logger';
import { AdsRepository } from './repository';
import {
  Ad,
  AdMediaInput,
  AD_MAX_IMAGES,
  AD_MAX_VIDEO_SECONDS,
  AD_MEDIA_FOLDER,
  AD_RADIUS_KM,
  AdApp,
  AdListFilter,
  AdPlacement,
  AdSettings,
  PublicAd,
  SaveAdParams,
} from './interfaces';

// How often (per server instance) finished ads are checked for media to delete.
const CLEANUP_EVERY_MS = 10 * 60 * 1000;
let lastCleanupAt = 0;

function toPublic(ad: Ad): PublicAd {
  return {
    id: ad.id,
    title: ad.title,
    description: ad.description,
    imageUrl: playbackUrl(ad.imageUrl, 'image'),
    imageUrls: ad.imageUrls.map((url) => playbackUrl(url, 'image') as string),
    videoUrl: playbackUrl(ad.videoUrl, 'video'),
    orientation: ad.orientation,
    durationSeconds: ad.durationSeconds,
    advertiserName: ad.advertiserName,
    // The business's own phone is the Call button's number.
    contactPhone: ad.advertiserPhone,
    locationText: ad.locationText,
    linkUrl: ad.linkUrl,
    endDate: ad.endDate,
  };
}

/** "sritextiles.com" → "https://sritextiles.com"; empty → null. */
function normalizeLink(link?: string | null): string | null {
  const value = link?.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function clean(params: SaveAdParams): SaveAdParams {
  const optional = (value?: string | null) => (value?.trim() ? value.trim() : null);
  return {
    ...params,
    advertiserName: params.advertiserName.trim(),
    // The ad itself is just its media; the title only names it in the list and on the bill.
    title: params.title?.trim() || params.advertiserName.trim(),
    advertiserPhone: optional(params.advertiserPhone),
    description: optional(params.description),
    locationText: params.locationText.trim(),
    linkUrl: normalizeLink(params.linkUrl),
  };
}

/** Whether ads are switched on for this app and place (the master switch first). */
export function placementOn(settings: AdSettings, app: AdApp, placement: AdPlacement): boolean {
  if (!settings.adsEnabled) return false;
  if (placement === 'launch') return app === 'user' ? settings.launchUser : settings.launchPartner;
  return app === 'user' ? settings.actionUser : settings.actionPartner;
}

/**
 * Ads booked by local businesses, entered by the admin after payment. Owns `ads`,
 * `ad_settings` and `ad_daily_stats`; depends on no other module.
 */
export class AdsService {
  constructor(private readonly repository: AdsRepository) {}

  // --- Apps ---

  /**
   * The ad to show now in this app and place, or null when ads are off there or none is
   * running near the viewer. Counts the view. `excludeId` is the ad this person saw last.
   */
  async serve(
    app: AdApp,
    placement: AdPlacement,
    viewer: { latitude: number; longitude: number },
    excludeId: string | null,
  ): Promise<PublicAd | null> {
    // Tidy up finished ads' media now and then (also run daily by the cron, and from the admin desk).
    if (Date.now() - lastCleanupAt > CLEANUP_EVERY_MS) {
      this.cleanupFinishedMedia().catch((err) => logger.warn({ err }, 'Ad media cleanup failed'));
    }
    const settings = await this.repository.getSettings();
    if (!placementOn(settings, app, placement)) return null;
    const ad = await this.repository.pickAndCount(excludeId, viewer.latitude, viewer.longitude);
    return ad ? toPublic(ad) : null;
  }

  async recordClick(id: string): Promise<void> {
    await this.repository.recordClick(id);
  }

  // --- Admin ---

  getSettings(): Promise<AdSettings> {
    return this.repository.getSettings();
  }

  updateSettings(changes: Partial<Omit<AdSettings, 'updatedAt'>>): Promise<AdSettings> {
    return this.repository.updateSettings(changes);
  }

  async overview() {
    await this.cleanupFinishedMedia().catch((err) => logger.warn({ err }, 'Ad media cleanup failed'));
    const [settings, summary] = await Promise.all([this.repository.getSettings(), this.repository.summary()]);
    return { settings, ...summary, prices: settings.prices, radiusKm: AD_RADIUS_KM };
  }

  list(filter: AdListFilter) {
    return this.repository.list(filter);
  }

  async get(id: string): Promise<Ad> {
    const ad = await this.repository.findById(id);
    if (!ad) throw AppError.notFound('Ad not found.', 'AD_NOT_FOUND');
    return ad;
  }

  /**
   * Books an ad at today's price for its plan, with its image or video when given (checked
   * first, so a refused video never leaves an ad without its media behind).
   */
  async create(params: SaveAdParams, media?: AdMediaInput): Promise<Ad> {
    const checked =
      media && (media.imageUrl || media.videoUrl) ? await this.checkMedia(media.imageUrl ?? null, media.videoUrl ?? null) : null;
    const { prices } = await this.repository.getSettings();
    const ad = await this.repository.create(clean(params), prices[String(params.planDays) as keyof typeof prices]);
    if (!checked) return ad;
    const result = await this.repository.setMedia(ad.id, checked.images, checked.videoUrl, checked.videoSeconds);
    return result?.ad ?? ad;
  }

  /**
   * Edits an ad. It keeps the amount it was booked at — a later price change never touches
   * past bookings — unless its plan itself is changed, which is priced like a new booking.
   */
  async update(id: string, params: SaveAdParams, media?: AdMediaInput): Promise<Ad> {
    const existing = await this.repository.findById(id);
    if (!existing || existing.status === 'deleted') throw AppError.notFound('Ad not found, or it was deleted.', 'AD_NOT_FOUND');
    let amount = existing.amount;
    if (existing.planDays !== params.planDays) {
      const { prices } = await this.repository.getSettings();
      amount = prices[String(params.planDays) as keyof typeof prices];
    }
    const ad = await this.repository.update(id, clean(params), amount);
    if (!ad) throw AppError.notFound('Ad not found, or it was deleted.', 'AD_NOT_FOUND');
    if (media && (media.imageUrl || media.videoUrl)) return this.setMedia(id, media.imageUrl ?? null, media.videoUrl ?? null);
    return ad;
  }

  /** Stops an ad (it stays in the history with its bill) and deletes its media straight away. */
  async remove(id: string): Promise<Ad> {
    const ad = await this.repository.softDelete(id);
    if (!ad) throw AppError.notFound('Ad not found, or it was already deleted.', 'AD_NOT_FOUND');
    await this.deleteMedia(ad.id, ad.imageUrls, ad.videoUrl);
    return { ...ad, imageUrl: null, imageUrls: [], videoUrl: null };
  }

  /**
   * Media of ads that have ended or were deleted: removed from Cloudinary and from the ad
   * (the ad's text, dates and bill stay in the history). Safe to call often.
   */
  async cleanupFinishedMedia(): Promise<number> {
    lastCleanupAt = Date.now();
    const finished = await this.repository.findFinishedWithMedia();
    for (const ad of finished) {
      await this.deleteMedia(ad.id, ad.imageUrls, ad.videoUrl);
    }
    if (finished.length > 0) logger.info({ count: finished.length }, 'Deleted media of finished ads');
    return finished.length;
  }

  /**
   * Files in the ads folder that no ad uses — the admin website uploads a file as soon as
   * it's chosen, so a changed or abandoned choice leaves one behind. Deleted once they're a
   * day old (newer ones may still be about to be saved with an ad).
   */
  async cleanupUnusedUploads(minAgeHours = 24): Promise<number> {
    const used = new Set((await this.repository.allMediaUrls()).map((url) => extractPublicIdFromUrl(url)).filter(Boolean));
    const cutoff = Date.now() - minAgeHours * 3600 * 1000;
    let removed = 0;
    for (const kind of ['image', 'video'] as const) {
      const unused = (await listCloudinaryFiles(`${AD_MEDIA_FOLDER}/`, kind))
        .filter((file) => !used.has(file.publicId) && new Date(file.createdAt).getTime() < cutoff)
        .map((file) => file.publicId);
      await deleteCloudinaryIds(unused, kind);
      removed += unused.length;
    }
    if (removed > 0) logger.info({ removed }, 'Deleted unused ad uploads');
    return removed;
  }

  private async deleteMedia(id: string, imageUrls: string[], videoUrl: string | null): Promise<void> {
    await deletePhotosFromCloudinary(imageUrls);
    if (videoUrl) await deleteVideosFromCloudinary([videoUrl]);
    await this.repository.clearMedia(id);
  }

  /** Permission for the admin website to upload one image or video straight to Cloudinary. */
  uploadSignature(kind: 'image' | 'video'): SignedUpload {
    return signDirectUpload(AD_MEDIA_FOLDER, kind);
  }

  /**
   * Sets an ad's one piece of media: an image or a video (uploaded by the admin website straight
   * to Cloudinary). A video longer than 30 seconds is deleted and refused. Media
   * the ad no longer uses is deleted from Cloudinary.
   */
  async setMedia(id: string, imageUrl: string | null, videoUrl: string | null): Promise<Ad> {
    const checked = await this.checkMedia(imageUrl, videoUrl);
    const result = await this.repository.setMedia(id, checked.images, checked.videoUrl, checked.videoSeconds);
    if (!result) throw AppError.notFound('Ad not found, or it was deleted.', 'AD_NOT_FOUND');
    await deletePhotosFromCloudinary(result.previousImages.filter((url) => !checked.images.includes(url)));
    if (result.previousVideo && result.previousVideo !== videoUrl) await deleteVideosFromCloudinary([result.previousVideo]);
    return result.ad;
  }

  /** One image or one video, ours, and a video no longer than 30 seconds (a longer one is deleted). */
  private async checkMedia(
    imageUrl: string | null,
    videoUrl: string | null,
  ): Promise<{ images: string[]; videoUrl: string | null; videoSeconds: number | null }> {
    if (!!imageUrl === !!videoUrl) throw AppError.badRequest('Add one image or one video.', 'AD_MEDIA_INVALID');
    if (imageUrl && !isOwnCloudinaryUrl(imageUrl, AD_MEDIA_FOLDER, 'image')) {
      throw AppError.badRequest('The image was not uploaded through Triolo.', 'AD_MEDIA_INVALID');
    }
    if (videoUrl && !isOwnCloudinaryUrl(videoUrl, AD_MEDIA_FOLDER, 'video')) {
      throw AppError.badRequest('The video was not uploaded through Triolo.', 'AD_MEDIA_INVALID');
    }
    let videoSeconds: number | null = null;
    if (videoUrl) {
      videoSeconds = await videoDurationSeconds(videoUrl);
      if (videoSeconds === null || videoSeconds > AD_MAX_VIDEO_SECONDS + 1) {
        await deleteVideosFromCloudinary([videoUrl]);
        throw AppError.badRequest(`The video must be ${AD_MAX_VIDEO_SECONDS} seconds or shorter.`, 'AD_VIDEO_TOO_LONG');
      }
    }
    const images = imageUrl ? [imageUrl].slice(0, AD_MAX_IMAGES) : [];
    return { images, videoUrl, videoSeconds };
  }
}
