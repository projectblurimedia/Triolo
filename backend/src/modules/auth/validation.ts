import { z } from 'zod';
import { SELF_REGISTERABLE_ROLES, SUPPORTED_LANGUAGES } from './interfaces';

const mobileNumber = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

const otp = z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits');

// Full name is free-text Unicode (Telugu names must work) — length-bounded only, no character-set restriction.
const preferredLanguage = z.enum(SUPPORTED_LANGUAGES as [string, ...string[]]);

export const requestRegistrationOtpSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is too short').max(100),
  mobileNumber,
  role: z.enum(SELF_REGISTERABLE_ROLES as [string, ...string[]]),
  preferredLanguage: preferredLanguage.optional(),
});

export const verifyRegistrationOtpSchema = z.object({
  mobileNumber,
  otp,
});

export const requestLoginOtpSchema = z.object({
  mobileNumber,
});

export const verifyLoginOtpSchema = z.object({
  mobileNumber,
  otp,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10),
});

export const updateLanguageSchema = z.object({
  preferredLanguage,
});
