import { AccessTokenPayload } from '@/modules/auth/interfaces';

declare global {
  namespace Express {
    interface Request {
      account?: AccessTokenPayload;
    }
  }
}

export {};
