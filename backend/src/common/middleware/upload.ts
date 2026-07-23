import multer, { FileFilterCallback } from 'multer';
import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '@/common/errors/AppError';
import { logger } from '@/common/utils/logger';

const TEMP_DIR = path.resolve(process.cwd(), 'temp/uploads');
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const ALLOWED_MIME_TYPES = /^image\/(jpeg|png|webp)$/;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    cb(null, TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ok = ALLOWED_EXTENSIONS.test(file.originalname) && ALLOWED_MIME_TYPES.test(file.mimetype);
  if (ok) {
    cb(null, true);
  } else {
    // An AppError here (rather than a plain Error) lets errorHandler's existing
    // `instanceof AppError` branch return a proper 400 with a specific code instead of
    // falling through to the generic 500 "something went wrong" response.
    cb(AppError.badRequest('Only JPEG, PNG, or WEBP image files are allowed', 'INVALID_FILE_TYPE'));
  }
}

/** Shared multer instance — disk storage to a temp dir, images only, 8MB per file (modern phone cameras can exceed 5MB even after client-side quality compression). */
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

/**
 * Logs exactly what multer received (count/size/mimetype per file) right after it parses
 * the request, before validation runs — so a client-reported upload failure is
 * diagnosable from the server log alone instead of guessed at from the client side.
 */
export function logUploadedFiles(req: Request, _res: Response, next: NextFunction): void {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length > 0) {
    logger.info(
      {
        path: req.originalUrl,
        count: files.length,
        files: files.map((f) => ({ originalname: f.originalname, mimetype: f.mimetype, sizeBytes: f.size })),
      },
      `Received ${files.length} file(s)`,
    );
  }
  next();
}
