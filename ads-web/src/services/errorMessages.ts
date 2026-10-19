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
  ACCOUNT_SUSPENDED: 'This account is suspended.',
  ACCOUNT_BLOCKED: 'This account has been banned.',
  ADMIN_ACCOUNT_PROTECTED: 'Admin accounts cannot be suspended, banned or removed.',
  BOOKING_INVALID_STATE: 'This booking is already finished.',
  BOOKING_REQUEST_NOT_FOUND: 'That booking no longer exists.',
  ORDER_INVALID_STATE: 'This order is already finished.',
  ORDER_NOT_FOUND: 'That order no longer exists.',
  PROBLEM_NOT_OPEN: 'Only a waiting problem post can be closed. Cancel its booking first.',
  PROBLEM_NOT_FOUND: 'That problem post no longer exists.',
  JOB_POST_NOT_FOUND: 'That job post no longer exists.',
};

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code && MESSAGES[err.code]) {
    return MESSAGES[err.code];
  }
  // An admin tool: the server's own message is clear enough when there's no friendlier one.
  if (err instanceof ApiError && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
