import { Router } from 'express';
import { pool } from '@/config/database';
import { validateBody } from '@/common/middleware/validate';
import { authenticate } from '@/common/middleware/authenticate';
import { otpRateLimiter } from '@/common/middleware/rateLimiter';
import { logUploadedFiles, upload } from '@/common/middleware/upload';
import { AuthController } from './controller';
import { AuthService } from './service';
import { AuthRepository } from './repository';
import {
  logoutSchema,
  refreshTokenSchema,
  requestLoginOtpSchema,
  requestRegistrationOtpSchema,
  updateLanguageSchema,
  updateWaitTimesSchema,
  updateProfileSchema,
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
authRouter.post('/login/request-otp', otpRateLimiter, validateBody(requestLoginOtpSchema), controller.requestLoginOtp);
authRouter.post('/login/verify-otp', otpRateLimiter, validateBody(verifyLoginOtpSchema), controller.verifyLoginOtp);
authRouter.post('/refresh', validateBody(refreshTokenSchema), controller.refresh);
authRouter.post('/logout', validateBody(logoutSchema), controller.logout);
authRouter.get('/me', authenticate, controller.me);
authRouter.patch('/me', authenticate, validateBody(updateProfileSchema), controller.updateProfile);
// Its own request, like profile photos elsewhere (keeps each body small for Vercel).
authRouter.put('/me/photo', authenticate, upload.single('photo'), logUploadedFiles, controller.setProfilePhoto);
authRouter.delete('/me/photo', authenticate, controller.removeProfilePhoto);
authRouter.patch('/me/language', authenticate, validateBody(updateLanguageSchema), controller.updateLanguage);
// How long the customer's Quick Book / personal booking / shop order requests wait for an answer.
authRouter.get('/me/wait-times', authenticate, controller.getWaitTimes);
authRouter.put('/me/wait-times', authenticate, validateBody(updateWaitTimesSchema), controller.updateWaitTimes);
