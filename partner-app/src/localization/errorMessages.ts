import { TFunction } from 'i18next';
import { ApiError } from '@/services/apiClient';
import { accountStandingMessage, STANDING_CODES } from './accountStanding';

/**
 * Maps an API error to a localized string via error.code — never displays the
 * raw API `message`, which is always English and meant for logs/debugging only.
 * See docs/localization.md.
 */
export function getLocalizedErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.code && STANDING_CODES.includes(error.code)) {
    return accountStandingMessage(error.code, error.details, t);
  }
  // A form the server rejected: name the fields instead of a generic "check your details".
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
    const fieldErrors = (error.details as { fieldErrors?: Record<string, unknown> } | undefined)?.fieldErrors;
    const fields = Object.keys(fieldErrors ?? {});
    if (fields.length > 0) {
      const names = [...new Set(fields.map((field) => t(`fieldNames.${field}`, { defaultValue: t('fieldNames.other') })))];
      return t('errors.validationFields', { fields: names.join(', ') });
    }
  }
  if (error instanceof ApiError && error.code) {
    const key = `errors.${error.code}`;
    const translated = t(key, { defaultValue: '' });
    if (translated) {
      return translated;
    }
  }
  return t('errors.generic');
}
