import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { created, ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { AuthService } from './service';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  requestRegistrationOtp = asyncHandler(async (req: Request, res: Response) => {
    await this.service.requestRegistrationOtp(req.body);
    return ok(res, { mobileNumber: req.body.mobileNumber }, 'OTP sent');
  });

  verifyRegistrationOtp = asyncHandler(async (req: Request, res: Response) => {
    const { account, tokens } = await this.service.verifyRegistrationOtp(req.body);
    return created(res, { ...tokens, account: toPublicAccount(account) }, 'Account created');
  });

  requestLoginOtp = asyncHandler(async (req: Request, res: Response) => {
    await this.service.requestLoginOtp(req.body);
    return ok(res, { mobileNumber: req.body.mobileNumber }, 'OTP sent');
  });

  verifyLoginOtp = asyncHandler(async (req: Request, res: Response) => {
    const { account, tokens } = await this.service.verifyLoginOtp(req.body);
    return ok(res, { ...tokens, account: toPublicAccount(account) }, 'Login successful');
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const tokens = await this.service.refreshAccessToken(req.body);
    return ok(res, tokens, 'Token refreshed');
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    await this.service.logout(req.body);
    return ok(res, null, 'Logged out');
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const account = await this.service.getAccount(req.account.accountId);
    return ok(res, toPublicAccount(account));
  });

  updateLanguage = asyncHandler(async (req: Request, res: Response) => {
    if (!req.account) {
      throw AppError.unauthorized();
    }
    const account = await this.service.updateLanguage(req.account.accountId, req.body);
    return ok(res, { preferredLanguage: account.preferredLanguage }, 'Language updated');
  });
}

function toPublicAccount(account: {
  id: string;
  fullName: string;
  mobileNumber: string;
  role: string;
  status: string;
  preferredLanguage: string;
}) {
  return {
    id: account.id,
    fullName: account.fullName,
    mobileNumber: account.mobileNumber,
    role: account.role,
    status: account.status,
    preferredLanguage: account.preferredLanguage,
  };
}
