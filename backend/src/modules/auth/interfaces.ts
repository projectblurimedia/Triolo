export type AccountRole = 'user' | 'worker' | 'business_owner' | 'business_staff' | 'admin';

export type AccountStatus = 'active' | 'pending_verification' | 'suspended' | 'blocked';

export type OtpPurpose = 'registration' | 'login';

/** See docs/localization.md. Adding a language later only requires a new value here + a mobile resource file. */
export type PreferredLanguage = 'en' | 'te';

export const SUPPORTED_LANGUAGES: PreferredLanguage[] = ['en', 'te'];

export interface Account {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  preferredLanguage: PreferredLanguage;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessTokenPayload {
  accountId: string;
  role: AccountRole;
  status: AccountStatus;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Every self-registered account is always 'user' — Worker and Business are optional
// capabilities added afterward (see modules/workers, modules/businesses), not an
// exclusive role chosen at registration. business_staff is invite-only; admin is
// provisioned separately.
