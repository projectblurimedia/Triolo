import { AuthService } from './service';
import { AuthRepository } from './repository';
import { hashOtp } from './otp.util';
import { generateRefreshToken, hashRefreshVerifier } from './jwt.util';
import { Account } from './interfaces';

type MockRepository = {
  [K in keyof AuthRepository]: jest.Mock;
};

function createMockRepository(): MockRepository {
  return {
    findAccountByMobile: jest.fn(),
    findAccountById: jest.fn(),
    createAccount: jest.fn(),
    updatePreferredLanguage: jest.fn(),
    createOtp: jest.fn(),
    findLatestActiveOtp: jest.fn(),
    incrementOtpAttempts: jest.fn(),
    consumeOtp: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshTokenBySelector: jest.fn(),
    revokeRefreshToken: jest.fn(),
  } as unknown as MockRepository;
}

function buildAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    fullName: 'Test Person',
    mobileNumber: '9876543210',
    email: 'test@example.com',
    role: 'user',
    status: 'active',
    preferredLanguage: 'en',
    latitude: 17.385,
    longitude: 78.4867,
    locationAddress: 'Hyderabad, Telangana',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const registrationRequestParams = {
  fullName: 'A',
  mobileNumber: '9876543210',
  email: 'a@example.com',
  latitude: 17.385,
  longitude: 78.4867,
  locationAddress: 'Hyderabad, Telangana',
};

describe('AuthService.requestRegistrationOtp', () => {
  it('rejects if the mobile number is already registered', async () => {
    const repo = createMockRepository();
    repo.findAccountByMobile.mockResolvedValue(buildAccount());
    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(service.requestRegistrationOtp(registrationRequestParams)).rejects.toMatchObject({
      statusCode: 409,
      code: 'MOBILE_ALREADY_REGISTERED',
    });

    expect(repo.createOtp).not.toHaveBeenCalled();
  });

  it('creates and stores an OTP for a new mobile number', async () => {
    const repo = createMockRepository();
    repo.findAccountByMobile.mockResolvedValue(null);
    const service = new AuthService(repo as unknown as AuthRepository);

    await service.requestRegistrationOtp(registrationRequestParams);

    expect(repo.createOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        mobileNumber: '9876543210',
        purpose: 'registration',
        fullName: 'A',
        email: 'a@example.com',
        latitude: 17.385,
        longitude: 78.4867,
        locationAddress: 'Hyderabad, Telangana',
        preferredLanguage: 'en',
      }),
    );
  });

  it('stores the requested preferred language when explicitly provided', async () => {
    const repo = createMockRepository();
    repo.findAccountByMobile.mockResolvedValue(null);
    const service = new AuthService(repo as unknown as AuthRepository);

    await service.requestRegistrationOtp({ ...registrationRequestParams, preferredLanguage: 'te' });

    expect(repo.createOtp).toHaveBeenCalledWith(expect.objectContaining({ preferredLanguage: 'te' }));
  });
});

describe('AuthService.verifyRegistrationOtp', () => {
  it('creates a user account with active status', async () => {
    const repo = createMockRepository();
    const otpHash = await hashOtp('111111');
    repo.findLatestActiveOtp.mockResolvedValue({
      id: 'otp-1',
      mobileNumber: '9876543210',
      otpHash,
      purpose: 'registration',
      fullName: 'A',
      email: 'a@example.com',
      latitude: 17.385,
      longitude: 78.4867,
      locationAddress: 'Hyderabad, Telangana',
      preferredLanguage: 'te',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attemptCount: 0,
    });
    repo.findAccountByMobile.mockResolvedValue(null);
    repo.createAccount.mockResolvedValue(buildAccount({ status: 'active', role: 'user', preferredLanguage: 'te' }));

    const service = new AuthService(repo as unknown as AuthRepository);
    const result = await service.verifyRegistrationOtp({ mobileNumber: '9876543210', otp: '111111' });

    expect(repo.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'user',
        status: 'active',
        email: 'a@example.com',
        locationAddress: 'Hyderabad, Telangana',
        preferredLanguage: 'te',
      }),
    );
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toContain('.');
  });

  it('rejects if registration details (email/location) are missing from the OTP record', async () => {
    const repo = createMockRepository();
    const otpHash = await hashOtp('111111');
    repo.findLatestActiveOtp.mockResolvedValue({
      id: 'otp-1',
      mobileNumber: '9876543210',
      otpHash,
      purpose: 'registration',
      fullName: 'A',
      email: null,
      latitude: null,
      longitude: null,
      locationAddress: null,
      preferredLanguage: 'en',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attemptCount: 0,
    });

    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(
      service.verifyRegistrationOtp({ mobileNumber: '9876543210', otp: '111111' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'OTP_CONTEXT_MISSING' });

    expect(repo.createAccount).not.toHaveBeenCalled();
  });

  it('rejects an incorrect OTP and records the attempt', async () => {
    const repo = createMockRepository();
    const otpHash = await hashOtp('111111');
    repo.findLatestActiveOtp.mockResolvedValue({
      id: 'otp-1',
      mobileNumber: '9876543210',
      otpHash,
      purpose: 'registration',
      fullName: 'A',
      email: 'a@example.com',
      locationAddress: 'Hyderabad, Telangana',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attemptCount: 0,
    });

    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(
      service.verifyRegistrationOtp({ mobileNumber: '9876543210', otp: '000000' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'OTP_INVALID' });

    expect(repo.incrementOtpAttempts).toHaveBeenCalledWith('otp-1');
    expect(repo.createAccount).not.toHaveBeenCalled();
  });

  it('rejects an expired OTP', async () => {
    const repo = createMockRepository();
    repo.findLatestActiveOtp.mockResolvedValue({
      id: 'otp-1',
      mobileNumber: '9876543210',
      otpHash: 'irrelevant',
      purpose: 'registration',
      fullName: 'A',
      email: 'a@example.com',
      locationAddress: 'Hyderabad, Telangana',
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
      attemptCount: 0,
    });

    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(
      service.verifyRegistrationOtp({ mobileNumber: '9876543210', otp: '111111' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'OTP_EXPIRED' });
  });

  it('rejects once attempt limit is exceeded', async () => {
    const repo = createMockRepository();
    repo.findLatestActiveOtp.mockResolvedValue({
      id: 'otp-1',
      mobileNumber: '9876543210',
      otpHash: 'irrelevant',
      purpose: 'registration',
      fullName: 'A',
      email: 'a@example.com',
      locationAddress: 'Hyderabad, Telangana',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attemptCount: 5,
    });

    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(
      service.verifyRegistrationOtp({ mobileNumber: '9876543210', otp: '111111' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'OTP_ATTEMPTS_EXCEEDED' });
  });
});

describe('AuthService.requestLoginOtp / verifyLoginOtp', () => {
  it('rejects requesting a login OTP for an unregistered mobile number', async () => {
    const repo = createMockRepository();
    repo.findAccountByMobile.mockResolvedValue(null);
    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(service.requestLoginOtp({ mobileNumber: '9876543210' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'ACCOUNT_NOT_FOUND',
    });
  });

  it('logs in successfully for an active account', async () => {
    const repo = createMockRepository();
    const otpHash = await hashOtp('222222');
    repo.findLatestActiveOtp.mockResolvedValue({
      id: 'otp-2',
      mobileNumber: '9876543210',
      otpHash,
      purpose: 'login',
      fullName: null,
      email: null,
      locationAddress: null,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attemptCount: 0,
    });
    repo.findAccountByMobile.mockResolvedValue(buildAccount({ status: 'active' }));

    const service = new AuthService(repo as unknown as AuthRepository);
    const result = await service.verifyLoginOtp({ mobileNumber: '9876543210', otp: '222222' });

    expect(result.account.status).toBe('active');
    expect(result.tokens.accessToken).toBeDefined();
  });

  it('rejects login for a blocked account', async () => {
    const repo = createMockRepository();
    const otpHash = await hashOtp('222222');
    repo.findLatestActiveOtp.mockResolvedValue({
      id: 'otp-2',
      mobileNumber: '9876543210',
      otpHash,
      purpose: 'login',
      fullName: null,
      email: null,
      locationAddress: null,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attemptCount: 0,
    });
    repo.findAccountByMobile.mockResolvedValue(buildAccount({ status: 'blocked' }));

    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(
      service.verifyLoginOtp({ mobileNumber: '9876543210', otp: '222222' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_NOT_ACTIVE' });
  });
});

describe('AuthService.refreshAccessToken', () => {
  it('rejects a malformed refresh token', async () => {
    const repo = createMockRepository();
    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(service.refreshAccessToken({ refreshToken: 'malformed' })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rejects when no matching token record exists', async () => {
    const repo = createMockRepository();
    repo.findRefreshTokenBySelector.mockResolvedValue(null);
    const { token } = generateRefreshToken();
    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(service.refreshAccessToken({ refreshToken: token })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rotates a valid refresh token and returns a new pair', async () => {
    const repo = createMockRepository();
    const { token, verifier } = generateRefreshToken();
    const tokenHash = await hashRefreshVerifier(verifier);

    repo.findRefreshTokenBySelector.mockResolvedValue({
      id: 'rt-1',
      accountId: 'account-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    repo.findAccountById.mockResolvedValue(buildAccount({ status: 'active' }));

    const service = new AuthService(repo as unknown as AuthRepository);
    const result = await service.refreshAccessToken({ refreshToken: token });

    expect(repo.revokeRefreshToken).toHaveBeenCalledWith('rt-1');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).not.toBe(token);
  });

  it('rejects a revoked refresh token', async () => {
    const repo = createMockRepository();
    const { token, verifier } = generateRefreshToken();
    const tokenHash = await hashRefreshVerifier(verifier);

    repo.findRefreshTokenBySelector.mockResolvedValue({
      id: 'rt-1',
      accountId: 'account-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });

    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(service.refreshAccessToken({ refreshToken: token })).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('AuthService.updateLanguage', () => {
  it('throws not found for an unknown account id', async () => {
    const repo = createMockRepository();
    repo.findAccountById.mockResolvedValue(null);
    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(service.updateLanguage('missing', { preferredLanguage: 'te' })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.updatePreferredLanguage).not.toHaveBeenCalled();
  });

  it('updates and returns the account with the new language', async () => {
    const repo = createMockRepository();
    repo.findAccountById.mockResolvedValue(buildAccount({ preferredLanguage: 'en' }));
    repo.updatePreferredLanguage.mockResolvedValue(buildAccount({ preferredLanguage: 'te' }));

    const service = new AuthService(repo as unknown as AuthRepository);
    const result = await service.updateLanguage('account-1', { preferredLanguage: 'te' });

    expect(repo.updatePreferredLanguage).toHaveBeenCalledWith('account-1', 'te');
    expect(result.preferredLanguage).toBe('te');
  });
});

describe('AuthService.getAccount', () => {
  it('throws not found for an unknown account id', async () => {
    const repo = createMockRepository();
    repo.findAccountById.mockResolvedValue(null);
    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(service.getAccount('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns the account when found', async () => {
    const repo = createMockRepository();
    repo.findAccountById.mockResolvedValue(buildAccount());
    const service = new AuthService(repo as unknown as AuthRepository);

    await expect(service.getAccount('account-1')).resolves.toMatchObject({ id: 'account-1' });
  });
});
