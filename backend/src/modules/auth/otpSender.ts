import { logger } from '@/common/utils/logger';

/**
 * Sends the login / sign-up OTP by SMS. Never used for service PINs (those stay in the apps).
 *
 * Provider: Fast2SMS's OTP route (India; new accounts get free test credit, then it is paid per
 * SMS). It is used only when FAST2SMS_API_KEY is set in the environment (Vercel → Settings →
 * Environment Variables) — never in code. Without a key, or if the provider fails, the OTP is
 * written to the server log (Vercel → Logs, search "OTP generated") so testing still works.
 * To switch providers later (MSG91, 2Factor …) only this file changes.
 */
export async function sendOtpSms(mobileNumber: string, otp: string): Promise<void> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    logger.info({ mobileNumber, otp }, 'OTP generated (no SMS provider configured yet - not actually sent via SMS)');
    return;
  }
  try {
    const numbers = mobileNumber.replace(/^\+?91/, '');
    const post = (payload: Record<string, string>) =>
      fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, numbers }),
      });
    // "otp" route: Fast2SMS's own fixed OTP text — cheap, but only after the website is verified
    // in Fast2SMS (OTP Message menu). Until then (code 996) it falls back to "q" (Quick SMS):
    // works without verification or DLT, but costs more per SMS.
    let response = await post({ route: 'otp', variables_values: otp });
    let body = (await response.json().catch(() => null)) as { return?: boolean; status_code?: number; message?: unknown } | null;
    if (!body?.return && body?.status_code === 996) {
      response = await post({ route: 'q', message: `Your Triolo code is ${otp}. Do not share it with anyone.`, flash: '0' });
      body = (await response.json().catch(() => null)) as typeof body;
    }
    if (!response.ok || !body?.return) {
      logger.error({ mobileNumber, status: response.status, body }, 'OTP SMS failed — OTP in the next log line');
      logger.info({ mobileNumber, otp }, 'OTP generated (SMS failed)');
      return;
    }
    logger.info({ mobileNumber }, 'OTP sent by SMS');
  } catch (err) {
    logger.error({ err, mobileNumber }, 'OTP SMS failed — OTP in the next log line');
    logger.info({ mobileNumber, otp }, 'OTP generated (SMS failed)');
  }
}
