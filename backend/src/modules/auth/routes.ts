import { Router } from 'express';
import { pool } from '@/config/database';
import { validateBody } from '@/common/middleware/validate';
import { authenticate } from '@/common/middleware/authenticate';
import { otpRateLimiter } from '@/common/middleware/rateLimiter';
import { AuthController } from './controller';
import { AuthService } from './service';
import { AuthRepository } from './repository';
import {
  logoutSchema,
  refreshTokenSchema,
  requestLoginOtpSchema,
  requestRegistrationOtpSchema,
  verifyLoginOtpSchema,
  verifyRegistrationOtpSchema,
} from './validation';

const repository = new AuthRepository(pool);
const service = new AuthService(repository);
const controller = new AuthController(service);

export const authRouter = Router();

authRouter.post(
  '/register/request-otp',
  otpRateLimiter,
  validateBody(requestRegistrationOtpSchema),
  controller.requestRegistrationOtp,
);
authRouter.post(
  '/register/verify-otp',
  otpRateLimiter,
  validateBody(verifyRegistrationOtpSchema),
  controller.verifyRegistrationOtp,
);
authRouter.post(
  '/login/request-otp',
  otpRateLimiter,
  validateBody(requestLoginOtpSchema),
  controller.requestLoginOtp,
);
authRouter.post(
  '/login/verify-otp',
  otpRateLimiter,
  validateBody(verifyLoginOtpSchema),
  controller.verifyLoginOtp,
);
authRouter.post('/refresh', validateBody(refreshTokenSchema), controller.refresh);
authRouter.post('/logout', validateBody(logoutSchema), controller.logout);
authRouter.get('/me', authenticate, controller.me);
