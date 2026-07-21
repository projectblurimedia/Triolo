import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from './interfaces';

const mobileNumber = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

const otp = z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits');

// Full name is free-text Unicode (Telugu names must work) — length-bounded only, no character-set restriction.
const preferredLanguage = z.enum(SUPPORTED_LANGUAGES as [string, ...string[]]);

// Coordinates are optional (manual address entry with no GPS fix yields none), but the
// address itself is always required — see LocationPicker on mobile.
const latitude = z.number().min(-90).max(90).nullable().optional();
const longitude = z.number().min(-180).max(180).nullable().optional();
const locationAddress = z.string().trim().min(2, 'Enter a location').max(255);

export const requestRegistrationOtpSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is too short').max(100),
  mobileNumber,
  email: z.string().trim().email('Enter a valid email address').max(255),
  latitude,
  longitude,
  locationAddress,
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
