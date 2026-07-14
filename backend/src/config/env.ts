import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  isTest: process.env.NODE_ENV === 'test',

  databaseUrl:
    process.env.NODE_ENV === 'test'
      ? required('TEST_DATABASE_URL', process.env.DATABASE_URL)
      : required('DATABASE_URL'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '30d',
  },

  otp: {
    expiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  },
};
