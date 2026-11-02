import { Linking } from 'react-native';

/** The public site with Triolo's legal pages (registration-web on Vercel). */
export const LEGAL_SITE = 'https://triolo-web.vercel.app';

export type LegalPage = 'privacy' | 'terms' | 'refunds';

export function openLegalPage(page: LegalPage): void {
  Linking.openURL(`${LEGAL_SITE}/${page}`).catch(() => undefined);
}
