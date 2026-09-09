import { logger } from '@/common/utils/logger';

/**
 * OTP delivery is only used for registration/login — never for service-completion
 * PINs (see docs/product-specification.md). No real SMS provider is wired up yet
 * (see docs' "Open Questions" — provider not chosen), so this always logs the OTP
 * instead of sending it, in every environment including the deployed Vercel backend
 * (NODE_ENV=production there) — view it via `vercel logs <deployment-url>` or the
 * Vercel dashboard's Logs tab, filtering for "OTP generated". This previously threw
 * instead of logging when `NODE_ENV === 'production'`, which broke registration/login
 * entirely on the deployed backend (no working alternative existed to fall back to —
 * the throw was a placeholder for a real provider that was never actually written).
 * Replace this whole function body with a real provider call once one is chosen; at
 * that point, reintroduce a production guard here if logging the OTP in production
 * should stop once a real send path exists.
 */
export async function sendOtpSms(mobileNumber: string, otp: string): Promise<void> {
  logger.info({ mobileNumber, otp }, 'OTP generated (no SMS provider configured yet - not actually sent via SMS)');
}
