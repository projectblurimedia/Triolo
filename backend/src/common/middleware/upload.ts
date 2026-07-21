import multer, { FileFilterCallback } from 'multer';
import fs from 'fs';
import path from 'path';
import { Request } from 'express';

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
    cb(new Error('Only JPEG, PNG, or WEBP image files are allowed'));
  }
}

/** Shared multer instance — disk storage to a temp dir, images only, 5MB per file. */
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
