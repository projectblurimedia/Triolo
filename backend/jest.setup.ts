process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRY ??= '15m';
process.env.JWT_REFRESH_EXPIRY ??= '30d';
process.env.OTP_EXPIRY_MINUTES ??= '5';
process.env.OTP_MAX_ATTEMPTS ??= '5';
process.env.TEST_DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/marketplace_test';
