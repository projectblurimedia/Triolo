import { generateOtp, hashOtp, verifyOtp } from './otp.util';

describe('otp.util', () => {
  it('generates a 6-digit numeric OTP', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('generates OTPs that vary across calls', () => {
    const otps = new Set(Array.from({ length: 20 }, () => generateOtp()));
    expect(otps.size).toBeGreaterThan(1);
  });

  it('hashes an OTP and verifies it correctly', async () => {
    const otp = '123456';
    const hash = await hashOtp(otp);

    expect(hash).not.toEqual(otp);
    await expect(verifyOtp(otp, hash)).resolves.toBe(true);
  });

  it('rejects an incorrect OTP against a hash', async () => {
    const hash = await hashOtp('123456');
    await expect(verifyOtp('654321', hash)).resolves.toBe(false);
  });
});
