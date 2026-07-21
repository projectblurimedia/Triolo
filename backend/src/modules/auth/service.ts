import { AppError } from '@/common/errors/AppError';
import { env } from '@/config/env';
import { AuthRepository } from './repository';
import { sendOtpSms } from './otpSender';
import { generateOtp, hashOtp, verifyOtp } from './otp.util';
import {
  compareRefreshVerifier,
  generateRefreshToken,
  hashRefreshVerifier,
  parseRefreshToken,
  refreshExpiryToDate,
  signAccessToken,
} from './jwt.util';
import { Account, AuthTokens } from './interfaces';
import {
  LogoutDto,
  RefreshTokenDto,
  RequestLoginOtpDto,
  RequestRegistrationOtpDto,
  UpdateLanguageDto,
  VerifyLoginOtpDto,
  VerifyRegistrationOtpDto,
} from './dto';

const BLOCKED_STATUSES = new Set(['suspended', 'blocked']);

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async requestRegistrationOtp(dto: RequestRegistrationOtpDto): Promise<void> {
    const existing = await this.repository.findAccountByMobile(dto.mobileNumber);
    if (existing) {
      throw AppError.conflict('This mobile number is already registered.', 'MOBILE_ALREADY_REGISTERED');
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    await this.repository.createOtp({
      mobileNumber: dto.mobileNumber,
      otpHash,
      purpose: 'registration',
      fullName: dto.fullName,
      email: dto.email,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      locationAddress: dto.locationAddress,
      preferredLanguage: dto.preferredLanguage ?? 'en',
      expiresAt: otpExpiryDate(),
    });

    await sendOtpSms(dto.mobileNumber, otp);
  }

  async verifyRegistrationOtp(dto: VerifyRegistrationOtpDto): Promise<{ account: Account; tokens: AuthTokens }> {
    const otpRecord = await this.consumeValidOtp(dto.mobileNumber, dto.otp, 'registration');

    if (!otpRecord.fullName || !otpRecord.email || !otpRecord.locationAddress) {
      throw AppError.badRequest('Registration details missing. Please request a new OTP.', 'OTP_CONTEXT_MISSING');
    }

    const existing = await this.repository.findAccountByMobile(dto.mobileNumber);
    if (existing) {
      throw AppError.conflict('This mobile number is already registered.', 'MOBILE_ALREADY_REGISTERED');
    }

    // Every self-registered account is a plain 'user', active immediately — Worker and
    // Business are optional capabilities added afterward (modules/workers,
    // modules/businesses), not an exclusive role chosen here.
    const account = await this.repository.createAccount({
      fullName: otpRecord.fullName,
      mobileNumber: dto.mobileNumber,
      email: otpRecord.email,
      role: 'user',
      status: 'active',
      preferredLanguage: otpRecord.preferredLanguage ?? 'en',
      latitude: otpRecord.latitude,
      longitude: otpRecord.longitude,
      locationAddress: otpRecord.locationAddress,
    });

    const tokens = await this.issueTokens(account);
    return { account, tokens };
  }

  async requestLoginOtp(dto: RequestLoginOtpDto): Promise<void> {
    const account = await this.repository.findAccountByMobile(dto.mobileNumber);
    if (!account) {
      throw AppError.notFound('No account found for this mobile number.', 'ACCOUNT_NOT_FOUND');
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    await this.repository.createOtp({
      mobileNumber: dto.mobileNumber,
      otpHash,
      purpose: 'login',
      expiresAt: otpExpiryDate(),
    });

    await sendOtpSms(dto.mobileNumber, otp);
  }

  async verifyLoginOtp(dto: VerifyLoginOtpDto): Promise<{ account: Account; tokens: AuthTokens }> {
    await this.consumeValidOtp(dto.mobileNumber, dto.otp, 'login');

    const account = await this.repository.findAccountByMobile(dto.mobileNumber);
    if (!account) {
      throw AppError.notFound('No account found for this mobile number.', 'ACCOUNT_NOT_FOUND');
    }
    if (BLOCKED_STATUSES.has(account.status)) {
      throw AppError.forbidden('This account has been suspended or blocked.', 'ACCOUNT_NOT_ACTIVE');
    }

    const tokens = await this.issueTokens(account);
    return { account, tokens };
  }

  async refreshAccessToken(dto: RefreshTokenDto): Promise<AuthTokens> {
    const parsed = parseRefreshToken(dto.refreshToken);
    if (!parsed) {
      throw AppError.unauthorized('Malformed refresh token.');
    }

    const record = await this.repository.findRefreshTokenBySelector(parsed.selector);
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token is invalid or expired.');
    }

    const isValid = await compareRefreshVerifier(parsed.verifier, record.tokenHash);
    if (!isValid) {
      throw AppError.unauthorized('Refresh token is invalid or expired.');
    }

    // Rotate: revoke the used token and issue a fresh pair.
    await this.repository.revokeRefreshToken(record.id);

    const account = await this.repository.findAccountById(record.accountId);
    if (!account || BLOCKED_STATUSES.has(account.status)) {
      throw AppError.unauthorized('Account is no longer active.');
    }

    return this.issueTokens(account);
  }

  async logout(dto: LogoutDto): Promise<void> {
    const parsed = parseRefreshToken(dto.refreshToken);
    if (!parsed) {
      return;
    }

    const record = await this.repository.findRefreshTokenBySelector(parsed.selector);
    if (!record || record.revokedAt) {
      return;
    }

    const isValid = await compareRefreshVerifier(parsed.verifier, record.tokenHash);
    if (isValid) {
      await this.repository.revokeRefreshToken(record.id);
    }
  }

  async getAccount(accountId: string): Promise<Account> {
    const account = await this.repository.findAccountById(accountId);
    if (!account) {
      throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    }
    return account;
  }

  async updateLanguage(accountId: string, dto: UpdateLanguageDto): Promise<Account> {
    const account = await this.repository.findAccountById(accountId);
    if (!account) {
      throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    }
    return this.repository.updatePreferredLanguage(accountId, dto.preferredLanguage);
  }

  private async consumeValidOtp(mobileNumber: string, otp: string, purpose: 'registration' | 'login') {
    const otpRecord = await this.repository.findLatestActiveOtp(mobileNumber, purpose);
    if (!otpRecord) {
      throw AppError.badRequest('No active OTP found. Please request a new one.', 'OTP_NOT_FOUND');
    }
    if (otpRecord.expiresAt < new Date()) {
      throw AppError.badRequest('OTP has expired. Please request a new one.', 'OTP_EXPIRED');
    }
    if (otpRecord.attemptCount >= env.otp.maxAttempts) {
      throw AppError.badRequest('Too many incorrect attempts. Please request a new OTP.', 'OTP_ATTEMPTS_EXCEEDED');
    }

    const isValid = await verifyOtp(otp, otpRecord.otpHash);
    if (!isValid) {
      await this.repository.incrementOtpAttempts(otpRecord.id);
      throw AppError.badRequest('Incorrect OTP.', 'OTP_INVALID');
    }

    await this.repository.consumeOtp(otpRecord.id);
    return otpRecord;
  }

  private async issueTokens(account: Account): Promise<AuthTokens> {
    const accessToken = signAccessToken({
      accountId: account.id,
      role: account.role,
      status: account.status,
    });

    const { token, selector, verifier } = generateRefreshToken();
    const tokenHash = await hashRefreshVerifier(verifier);
    await this.repository.createRefreshToken({
      accountId: account.id,
      selector,
      tokenHash,
      expiresAt: refreshExpiryToDate(),
    });

    return { accessToken, refreshToken: token };
  }
}

function otpExpiryDate(): Date {
  return new Date(Date.now() + env.otp.expiryMinutes * 60_000);
}
