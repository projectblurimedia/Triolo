import { TFunction } from 'i18next';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The two codes the server sends for a suspended or banned account (on login and on any request). */
export const STANDING_CODES = ['ACCOUNT_SUSPENDED', 'ACCOUNT_BLOCKED'];

/**
 * "Your account is suspended until 15 Oct 2026. Reason: …" — from the error's code and details.
 * Kept apart from apiClient so both apiClient and errorMessages can use it without importing
 * each other. Manual date format: Hermes on Android doesn't reliably ship full Intl data.
 */
export function accountStandingMessage(code: string, details: unknown, t: TFunction): string {
  const { until, reason } = (details ?? {}) as { until?: string | null; reason?: string | null };
  let message: string;
  if (code === 'ACCOUNT_SUSPENDED' && until) {
    const date = new Date(until);
    message = t('errors.ACCOUNT_SUSPENDED_UNTIL', { date: `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` });
  } else {
    message = t(`errors.${code}`);
  }
  return reason ? `${message} ${t('errors.standingReason', { reason })}` : message;
}
