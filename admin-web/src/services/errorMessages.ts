import { ApiError } from './apiClient';

/** Same error.code -> message convention the mobile apps use (docs/localization.md) — never show the raw API `message`, which is for logs/debugging only. English-only here (no localization for this first pass — see .cloud/architecture.md). */
const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Please check the details you entered.',
  MOBILE_ALREADY_REGISTERED: 'This mobile number is already registered.',
  ACCOUNT_NOT_FOUND: 'No account found for this mobile number.',
  OTP_NOT_FOUND: 'No active OTP found. Please request a new one.',
  OTP_EXPIRED: 'Your OTP has expired. Please request a new one.',
  OTP_ATTEMPTS_EXCEEDED: 'Too many incorrect attempts. Please request a new OTP.',
  OTP_INVALID: 'Incorrect OTP. Please try again.',
  ACCOUNT_NOT_ACTIVE: 'This account has been suspended or blocked.',
  RATE_LIMITED: 'Too many attempts. Please wait a bit and try again.',
  WORKER_PROFILE_EXISTS: 'You already have a worker profile.',
  BUSINESS_PROFILE_EXISTS: 'You already have a business profile.',
  WORKER_PROFILE_NOT_FOUND: "We couldn't find that worker profile.",
  BUSINESS_PROFILE_NOT_FOUND: "We couldn't find that business profile.",
  FILE_UPLOAD_ERROR: "One of your photos couldn't be uploaded. Please try a smaller photo.",
  INVALID_FILE_TYPE: 'Please choose a JPEG, PNG, or WEBP image.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you're looking for.",
};

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code && MESSAGES[err.code]) {
    return MESSAGES[err.code];
  }
  return 'Something went wrong. Please try again.';
}
