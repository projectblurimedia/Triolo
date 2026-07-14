import { Response } from 'express';

export function ok<T>(res: Response, data: T, message = 'Success', statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, message, data });
}

export function created<T>(res: Response, data: T, message = 'Created'): Response {
  return ok(res, data, message, 201);
}
