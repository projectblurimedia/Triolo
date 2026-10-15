import { NextFunction, Request, Response } from 'express';
import { AppError } from '@/common/errors/AppError';
import { verifyAccessToken } from '@/modules/auth/jwt.util';
import { assertAccountInGoodStanding } from '@/modules/auth/accountAccess';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    req.account = verifyAccessToken(token);
  } catch {
    next(AppError.unauthorized('Invalid or expired access token'));
    return;
  }
  // A suspended or banned account is stopped on its very next request (cached ~30s).
  assertAccountInGoodStanding(req.account.accountId).then(() => next(), next);
}
