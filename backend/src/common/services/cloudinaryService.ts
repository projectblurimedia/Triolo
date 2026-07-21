import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { env } from '@/config/env';
import { AppError } from '@/common/errors/AppError';

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
