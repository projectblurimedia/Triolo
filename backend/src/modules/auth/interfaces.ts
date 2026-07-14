export type AccountRole = 'user' | 'worker' | 'business_owner' | 'business_staff' | 'admin';

export type AccountStatus = 'active' | 'pending_verification' | 'suspended' | 'blocked';

export type OtpPurpose = 'registration' | 'login';

export interface Account {
  id: string;
  fullName: string;
  mobileNumber: string;
  role: AccountRole;
  status: AccountStatus;
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
