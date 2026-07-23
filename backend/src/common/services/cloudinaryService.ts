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
    throw AppError.badRequest(
      'Image uploads are not configured on this server yet.',
      'CLOUDINARY_NOT_CONFIGURED',
    );
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
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
      logger.warn({ err, publicId }, 'Failed to delete Cloudinary asset');
    }
  }
}
