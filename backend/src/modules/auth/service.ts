import { PreferredLanguage } from './interfaces';
import { AppError } from '@/common/errors/AppError';
import { env } from '@/config/env';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
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
import {
  Account,
  AuthTokens,
  AccountModerationAction,
  AdminAccountListFilter,
  AdminAccountListResult,
  AdminAccountStats,
} from './interfaces';
import { forgetAccountStanding, standingError } from './accountAccess';
import {
  LogoutDto,
  UpdateProfileDto,
  RefreshTokenDto,
  RequestLoginOtpDto,
  RequestRegistrationOtpDto,
  UpdateLanguageDto,
  WaitTimes,
  VerifyLoginOtpDto,
  VerifyRegistrationOtpDto,
} from './dto';

const BLOCKED_STATUSES = new Set(['suspended', 'blocked']);
const PROFILE_PHOTO_FOLDER = 'triolo/accounts/profile';

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

    if (!otpRecord.fullName) {
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
    const account = await this.liftIfExpired(await this.repository.findAccountByMobile(dto.mobileNumber));
    if (!account) {
      throw AppError.notFound('No account found for this mobile number.', 'ACCOUNT_NOT_FOUND');
    }
    // A suspended or banned account is told why before any OTP is sent.
    const standing = standingError(account.status, account.suspendedUntil, account.statusReason);
    if (standing) throw standing;

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

    const account = await this.liftIfExpired(await this.repository.findAccountByMobile(dto.mobileNumber));
    if (!account) {
      throw AppError.notFound('No account found for this mobile number.', 'ACCOUNT_NOT_FOUND');
    }
    const standing = standingError(account.status, account.suspendedUntil, account.statusReason);
    if (standing) throw standing;

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

    const account = await this.liftIfExpired(await this.repository.findAccountById(record.accountId));
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

  async updateProfile(accountId: string, dto: UpdateProfileDto): Promise<Account> {
    await this.getAccount(accountId);
    return this.repository.updateProfile(accountId, dto);
  }

  /** Uploads the account photo (replacing any previous one). */
  async setProfilePhoto(accountId: string, file: Express.Multer.File | undefined): Promise<Account> {
    if (!file) throw AppError.badRequest('A photo is required.', 'PHOTO_REQUIRED');
    const uploaded = await uploadToCloudinary(file.path, PROFILE_PHOTO_FOLDER);
    const result = await this.repository.setProfilePhoto(accountId, uploaded.url);
    if (!result) {
      await deletePhotosFromCloudinary([uploaded.url]);
      throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    }
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.account;
  }

  async removeProfilePhoto(accountId: string): Promise<Account> {
    const result = await this.repository.setProfilePhoto(accountId, null);
    if (!result) throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.account;
  }

  /** Profile → Waiting Time. Saving applies at once, also to requests already waiting. */
  async getWaitTimes(accountId: string): Promise<WaitTimes> {
    const times = await this.repository.getWaitTimes(accountId);
    if (!times) throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    return times;
  }

  async updateWaitTimes(accountId: string, dto: WaitTimes): Promise<WaitTimes> {
    const times = await this.repository.updateWaitTimes(accountId, dto);
    if (!times) throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    return times;
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

  /** A suspension past its end date is lifted before anything checks it. */
  private async liftIfExpired(account: Account | null): Promise<Account | null> {
    if (account && account.status === 'suspended' && account.suspendedUntil && account.suspendedUntil <= new Date()) {
      await this.repository.liftExpiredSuspension(account.id);
      return this.repository.findAccountById(account.id);
    }
    return account;
  }

  // --- Admin ---

  /**
   * The account with this number, made (active, no password — they sign in with OTP) if there is
   * none yet: a shop owner adding delivery staff who have never used Triolo.
   */
  async findOrCreateByMobile(
    mobileNumber: string,
    fullName: string,
    preferredLanguage: PreferredLanguage = 'en',
  ): Promise<{ id: string; fullName: string }> {
    const existing = await this.repository.findAccountByMobile(mobileNumber);
    if (existing) return { id: existing.id, fullName: existing.fullName };
    const account = await this.repository.createAccount({
      fullName,
      mobileNumber,
      email: null,
      role: 'user',
      status: 'active',
      // The owner's language (they set the person up); the person can change it after logging in.
      preferredLanguage,
      latitude: null,
      longitude: null,
      locationAddress: null,
    });
    return { id: account.id, fullName: account.fullName };
  }

  /** The account with this mobile number (for other modules, e.g. promoting a profile in an ad). */
  async findAccountByMobile(mobileNumber: string): Promise<{ id: string; fullName: string } | null> {
    const account = await this.repository.findAccountByMobile(mobileNumber);
    return account ? { id: account.id, fullName: account.fullName } : null;
  }

  adminListAccounts(filter: AdminAccountListFilter): Promise<AdminAccountListResult> {
    return this.repository.adminList(filter);
  }

  async adminGetAccount(accountId: string): Promise<Account> {
    const account = await this.liftIfExpired(await this.repository.findAccountById(accountId));
    if (!account) throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    return account;
  }

  adminStats(): Promise<AdminAccountStats> {
    return this.repository.adminStats();
  }

  /**
   * Suspend (for `days`), ban permanently, or reactivate. A suspended or banned account is
   * signed out everywhere at once. Admin accounts can't be moderated from here.
   */
  async adminModerate(
    accountId: string,
    action: AccountModerationAction,
    options: { days?: number; reason?: string | null } = {},
  ): Promise<Account> {
    const account = await this.adminGetAccount(accountId);
    if (account.role === 'admin') {
      throw AppError.forbidden('Admin accounts cannot be suspended or banned.', 'ADMIN_ACCOUNT_PROTECTED');
    }
    const reason = options.reason?.trim() || null;
    let updated: Account | null;
    if (action === 'reactivate') {
      updated = await this.repository.adminSetStatus(accountId, 'active', null, null);
    } else if (action === 'suspend') {
      const days = Math.min(365, Math.max(1, Math.round(options.days ?? 1)));
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      updated = await this.repository.adminSetStatus(accountId, 'suspended', until, reason);
    } else {
      updated = await this.repository.adminSetStatus(accountId, 'blocked', null, reason);
    }
    if (!updated) throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    if (action !== 'reactivate') await this.repository.revokeAllRefreshTokens(accountId);
    forgetAccountStanding(accountId);
    return updated;
  }
}

function otpExpiryDate(): Date {
  return new Date(Date.now() + env.otp.expiryMinutes * 60_000);
}
