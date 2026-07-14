import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '@/common/errors/AppError';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(AppError.badRequest('Invalid request body', 'VALIDATION_ERROR', result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}
