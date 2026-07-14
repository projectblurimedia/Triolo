import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './en.json';
import te from './te.json';

// Hermes/older JSC builds lack Intl.PluralRules; without it i18next silently
// falls back to a less-accurate plural format. Telugu has its own plural rules,
// so polyfill rather than rely on the fallback.
if (typeof Intl === 'undefined' || typeof (Intl as { PluralRules?: unknown }).PluralRules === 'undefined') {
  require('@formatjs/intl-pluralrules/polyfill');
  require('@formatjs/intl-pluralrules/locale-data/en');
  require('@formatjs/intl-pluralrules/locale-data/te');
}

export const SUPPORTED_LANGUAGES = ['en', 'te'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'en';
const defaultLanguage: SupportedLanguage = SUPPORTED_LANGUAGES.includes(deviceLanguage as SupportedLanguage)
  ? (deviceLanguage as SupportedLanguage)
  : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    te: { translation: te },
  },
  lng: defaultLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
