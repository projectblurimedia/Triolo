import { TFunction } from 'i18next';
import { ApiError } from '@/services/apiClient';

/**
 * Maps an API error to a localized string via error.code — never displays the
 * raw API `message`, which is always English and meant for logs/debugging only.
 * See docs/localization.md.
 */
export function getLocalizedErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.code) {
    const key = `errors.${error.code}`;
    const translated = t(key, { defaultValue: '' });
    if (translated) {
      return translated;
    }
  }
  return t('errors.generic');
}
