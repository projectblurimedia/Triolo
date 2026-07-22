import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '@/common/errors/AppError';
import { logger } from '@/common/utils/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    error: { code: 'ROUTE_NOT_FOUND' },
  });
}

const MULTER_ERROR_MESSAGES: Partial<Record<string, string>> = {
  LIMIT_FILE_SIZE: 'Each photo must be under 8MB. Please choose a smaller photo.',
  LIMIT_FILE_COUNT: 'Too many photos selected.',
  LIMIT_UNEXPECTED_FILE: 'Too many photos selected.',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: { code: err.code, details: err.details },
    });
    return;
  }

  // multer throws its own error class (not AppError) when a file exceeds the size/count
  // limit — without this, a too-large photo surfaced as a generic 500 "something went
  // wrong" instead of the specific, actionable reason.
  if (err instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      message: MULTER_ERROR_MESSAGES[err.code] ?? 'There was a problem with the uploaded file.',
      error: { code: 'FILE_UPLOAD_ERROR' },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
    error: { code: 'INTERNAL_SERVER_ERROR' },
  });
}
