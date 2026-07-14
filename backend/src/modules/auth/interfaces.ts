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
  role: AccountRole;
  status: AccountStatus;
  preferredLanguage: PreferredLanguage;
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

/** Roles a person can self-register as. business_staff is invite-only; admin is provisioned separately. */
export const SELF_REGISTERABLE_ROLES: AccountRole[] = ['user', 'worker', 'business_owner'];
