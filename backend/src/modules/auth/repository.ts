import { Pool, QueryResultRow } from 'pg';
import { Account, AccountRole, AccountStatus, OtpPurpose, PreferredLanguage } from './interfaces';

interface OtpRecord {
  id: string;
  mobileNumber: string;
  otpHash: string;
  purpose: OtpPurpose;
  fullName: string | null;
  role: AccountRole | null;
  preferredLanguage: PreferredLanguage | null;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
}

interface RefreshTokenRecord {
  id: string;
  accountId: string;
  selector: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

function mapAccount(row: QueryResultRow): Account {
  return {
    id: row.id,
    fullName: row.full_name,
    mobileNumber: row.mobile_number,
    role: row.role,
    status: row.status,
    preferredLanguage: row.preferred_language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOtp(row: QueryResultRow): OtpRecord {
  return {
    id: row.id,
    mobileNumber: row.mobile_number,
    otpHash: row.otp_hash,
    purpose: row.purpose,
    fullName: row.full_name,
    role: row.role,
    preferredLanguage: row.preferred_language,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    attemptCount: row.attempt_count,
  };
}

function mapRefreshToken(row: QueryResultRow): RefreshTokenRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    selector: row.selector,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export class AuthRepository {
  constructor(private readonly pool: Pool) {}

  async findAccountByMobile(mobileNumber: string): Promise<Account | null> {
    const result = await this.pool.query('SELECT * FROM accounts WHERE mobile_number = $1', [mobileNumber]);
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async findAccountById(id: string): Promise<Account | null> {
    const result = await this.pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async createAccount(params: {
    fullName: string;
    mobileNumber: string;
    role: AccountRole;
    status: AccountStatus;
    preferredLanguage: PreferredLanguage;
  }): Promise<Account> {
    const result = await this.pool.query(
      `INSERT INTO accounts (full_name, mobile_number, role, status, preferred_language)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [params.fullName, params.mobileNumber, params.role, params.status, params.preferredLanguage],
    );
    return mapAccount(result.rows[0]);
  }

  async updatePreferredLanguage(accountId: string, preferredLanguage: PreferredLanguage): Promise<Account> {
    const result = await this.pool.query(
      `UPDATE accounts SET preferred_language = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [accountId, preferredLanguage],
    );
    return mapAccount(result.rows[0]);
  }

  async createOtp(params: {
    mobileNumber: string;
    otpHash: string;
    purpose: OtpPurpose;
    fullName?: string;
    role?: AccountRole;
    preferredLanguage?: PreferredLanguage;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO otp_verifications (mobile_number, otp_hash, purpose, full_name, role, preferred_language, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.mobileNumber,
        params.otpHash,
        params.purpose,
        params.fullName ?? null,
        params.role ?? null,
        params.preferredLanguage ?? null,
        params.expiresAt,
      ],
    );
  }

  async findLatestActiveOtp(mobileNumber: string, purpose: OtpPurpose): Promise<OtpRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM otp_verifications
       WHERE mobile_number = $1 AND purpose = $2 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [mobileNumber, purpose],
    );
    return result.rows[0] ? mapOtp(result.rows[0]) : null;
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    await this.pool.query('UPDATE otp_verifications SET attempt_count = attempt_count + 1 WHERE id = $1', [id]);
  }

  async consumeOtp(id: string): Promise<void> {
    await this.pool.query('UPDATE otp_verifications SET consumed_at = now() WHERE id = $1', [id]);
  }

  async createRefreshToken(params: {
    accountId: string;
    selector: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO refresh_tokens (account_id, selector, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [params.accountId, params.selector, params.tokenHash, params.expiresAt],
    );
  }

  async findRefreshTokenBySelector(selector: string): Promise<RefreshTokenRecord | null> {
    const result = await this.pool.query('SELECT * FROM refresh_tokens WHERE selector = $1', [selector]);
    return result.rows[0] ? mapRefreshToken(result.rows[0]) : null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [id]);
  }
}
