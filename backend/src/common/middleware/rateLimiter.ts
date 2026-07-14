import rateLimit from 'express-rate-limit';

/** Applied to OTP request/verify endpoints to prevent brute force and SMS-cost abuse. */
export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
    error: { code: 'RATE_LIMITED' },
  },
});
