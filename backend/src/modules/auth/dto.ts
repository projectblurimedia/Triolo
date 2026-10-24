import { PreferredLanguage } from './interfaces';

export interface RequestRegistrationOtpDto {
  fullName: string;
  mobileNumber: string;
  email?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string;
  preferredLanguage?: PreferredLanguage;
}

export interface VerifyRegistrationOtpDto {
  mobileNumber: string;
  otp: string;
}

export interface RequestLoginOtpDto {
  mobileNumber: string;
}

export interface VerifyLoginOtpDto {
  mobileNumber: string;
  otp: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface LogoutDto {
  refreshToken: string;
}

/** Minutes each kind of request waits for an answer before it ends by itself. */
export interface WaitTimes {
  quickBookMinutes: number;
  directMinutes: number;
  orderMinutes: number;
  quickOrderMinutes?: number;
}

export interface UpdateLanguageDto {
  preferredLanguage: PreferredLanguage;
}

export interface UpdateProfileDto {
  fullName?: string;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string | null;
}
