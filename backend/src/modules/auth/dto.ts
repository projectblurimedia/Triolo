import { AccountRole } from './interfaces';

export interface RequestRegistrationOtpDto {
  fullName: string;
  mobileNumber: string;
  role: AccountRole;
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
