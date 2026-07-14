import { NextFunction, Request, Response } from 'express';
import { AppError } from '@/common/errors/AppError';
import { AccountRole } from '@/modules/auth/interfaces';

export function authorize(...allowedRoles: AccountRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.account) {
      next(AppError.unauthorized());
      return;
    }
    if (!allowedRoles.includes(req.account.role)) {
      next(AppError.forbidden('You do not have permission to perform this action'));
      return;
    }
    next();
  };
}
