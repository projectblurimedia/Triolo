import { logger } from '@/common/utils/logger';
import { env } from '@/config/env';

/**
 * OTP delivery is only used for registration/login — never for service-completion
 * PINs (see docs/product-specification.md). Swap this for a real SMS provider
 * integration when one is chosen; until then, non-production environments log
 * the OTP so registration/login can be exercised end-to-end without an SMS bill.
 */
export async function sendOtpSms(mobileNumber: string, otp: string): Promise<void> {
  if (env.nodeEnv === 'production') {
    throw new Error('SMS provider not configured. Wire up a real provider before enabling production OTP delivery.');
  }
  logger.info({ mobileNumber, otp }, 'OTP generated (dev/test mode - not actually sent via SMS)');
}
