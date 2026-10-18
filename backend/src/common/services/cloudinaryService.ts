import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { env } from '@/config/env';
import { AppError } from '@/common/errors/AppError';
import { logger } from '@/common/utils/logger';

let configured = false;

function ensureConfigured(): void {
  if (configured) {
    return;
  }
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw AppError.badRequest('Image uploads are not configured on this server yet.', 'CLOUDINARY_NOT_CONFIGURED');
  }
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
  configured = true;
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Uploads a locally-saved file (written by the multer disk-storage middleware, see
 * common/middleware/upload.ts) to Cloudinary and always cleans up the local temp file
 * afterward, success or failure — mirrors the pattern proven in a sibling project.
 */
export async function uploadToCloudinary(filePath: string, folder: string): Promise<CloudinaryUploadResult> {
  ensureConfigured();
  try {
    const result = await cloudinary.uploader.upload(filePath, { folder, resource_type: 'image' });
    return { url: result.secure_url, publicId: result.public_id };
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * Cloudinary secure URLs embed the public_id in their path:
 * https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext}
 * Only the URL (not the public_id) is persisted per photo, so this is how removed/replaced
 * photos and deleted profiles find what to clean up in Cloudinary.
 */
export function extractPublicIdFromUrl(url: string): string | null {
  const match = url.match(/\/upload\/v\d+\/(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
}

/**
 * Best-effort cleanup — a photo no longer being kept (dropped during an edit) or a whole
 * profile being deleted shouldn't leave orphaned assets in Cloudinary storage forever.
 * Failures are logged, not thrown: a Cloudinary hiccup must never block the user's actual
 * profile update/delete from succeeding.
 */
export async function deletePhotosFromCloudinary(urls: string[]): Promise<void> {
  await deleteFromCloudinary(urls, 'image');
}

/** Same as deletePhotosFromCloudinary, for videos (Cloudinary keeps them separately). */
export async function deleteVideosFromCloudinary(urls: string[]): Promise<void> {
  await deleteFromCloudinary(urls, 'video');
}

async function deleteFromCloudinary(urls: string[], resourceType: 'image' | 'video'): Promise<void> {
  if (urls.length === 0) {
    return;
  }
  try {
    ensureConfigured();
  } catch (err) {
    logger.warn({ err }, 'Skipping Cloudinary cleanup — not configured');
    return;
  }
  for (const url of urls) {
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) {
      continue;
    }
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
    } catch (err) {
      logger.warn({ err, publicId }, 'Failed to delete Cloudinary asset');
    }
  }
}

export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: 'image' | 'video';
  /** Extra signed upload fields the client must send as-is (e.g. `eager` for videos). */
  extra: Record<string, string>;
}

/**
 * The lighter copy of an ad video the apps play: at most 720 px wide, quality chosen by
 * Cloudinary, H.264 MP4 (plays everywhere). Prepared right after upload (`eager`), so the
 * first viewer doesn't wait for it.
 */
const PLAYBACK_VIDEO = 'c_limit,q_auto,vc_h264,w_720';
/** Ad images for phones: at most 1080 px wide, best format and quality for each phone. */
const PLAYBACK_IMAGE = 'c_limit,f_auto,q_auto,w_1080';

/** The phone-friendly version of one of our Cloudinary files (other URLs are returned as-is). */
export function playbackUrl(url: string | null, resourceType: 'image' | 'video'): string | null {
  if (!url) return url;
  const marker = `/${resourceType}/upload/`;
  const at = url.indexOf(marker);
  if (at < 0) return url;
  const transformation = resourceType === 'video' ? PLAYBACK_VIDEO : PLAYBACK_IMAGE;
  const rest = url.slice(at + marker.length);
  const withFormat = resourceType === 'video' ? rest.replace(/\.[a-zA-Z0-9]+$/, '.mp4') : rest;
  return `${url.slice(0, at + marker.length)}${transformation}/${withFormat}`;
}

/**
 * Lets a trusted client (the admin website) upload one file straight to Cloudinary. Needed
 * for videos: Vercel rejects request bodies over 4.5 MB, so they can't pass through this
 * server. The signature only allows uploads into `folder`, and expires after an hour.
 */
export function signDirectUpload(folder: string, resourceType: 'image' | 'video'): SignedUpload {
  ensureConfigured();
  const timestamp = Math.round(Date.now() / 1000);
  // Videos: have Cloudinary prepare the phone-friendly copy straight away, in the background.
  const extra: Record<string, string> = resourceType === 'video' ? { eager: `${PLAYBACK_VIDEO}/mp4`, eager_async: 'true' } : {};
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp, ...extra }, env.cloudinary.apiSecret);
  return {
    cloudName: env.cloudinary.cloudName,
    apiKey: env.cloudinary.apiKey,
    timestamp,
    signature,
    folder,
    resourceType,
    extra,
  };
}

/** Every file of this kind in a folder (public id and upload time), for clean-ups. */
export async function listCloudinaryFiles(
  prefix: string,
  resourceType: 'image' | 'video',
): Promise<{ publicId: string; createdAt: string }[]> {
  ensureConfigured();
  const files: { publicId: string; createdAt: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await cloudinary.api.resources({
      type: 'upload',
      resource_type: resourceType,
      prefix,
      max_results: 500,
      next_cursor: cursor,
    });
    for (const file of page.resources) files.push({ publicId: file.public_id, createdAt: file.created_at });
    cursor = page.next_cursor;
  } while (cursor);
  return files;
}

/** Deletes files by public id (best effort, like the URL-based deletes). */
export async function deleteCloudinaryIds(publicIds: string[], resourceType: 'image' | 'video'): Promise<void> {
  for (const publicId of publicIds) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
    } catch (err) {
      logger.warn({ err, publicId }, 'Failed to delete Cloudinary asset');
    }
  }
}

/** A video's length in seconds, read from Cloudinary (null if it can't be found). */
export async function videoDurationSeconds(url: string): Promise<number | null> {
  ensureConfigured();
  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) return null;
  try {
    // A video's length is only included when its media details are asked for.
    const resource = await cloudinary.api.resource(publicId, { resource_type: 'video', media_metadata: true });
    return typeof resource.duration === 'number' ? Math.round(resource.duration * 10) / 10 : null;
  } catch (err) {
    logger.warn({ err, publicId }, 'Could not read the video length');
    return null;
  }
}

/** Whether `url` is a file of ours, of this kind, inside `folder` (never trust a client's URL blindly). */
export function isOwnCloudinaryUrl(url: string, folder: string, resourceType: 'image' | 'video'): boolean {
  const prefix = `https://res.cloudinary.com/${env.cloudinary.cloudName}/${resourceType}/upload/`;
  return url.startsWith(prefix) && url.includes(`/${folder}/`);
}
