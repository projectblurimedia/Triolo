import { Pool, QueryResultRow } from 'pg';
import {
  Account,
  AccountRole,
  AccountStatus,
  OtpPurpose,
  PreferredLanguage,
  AdminAccountListFilter,
  AdminAccountListResult,
  AdminAccountStats,
} from './interfaces';

interface OtpRecord {
  id: string;
  mobileNumber: string;
  otpHash: string;
  purpose: OtpPurpose;
  fullName: string | null;
  role: AccountRole | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
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
    email: row.email,
    role: row.role,
    status: row.status,
    preferredLanguage: row.preferred_language,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAddress: row.location_address,
    suspendedUntil: row.suspended_until ?? null,
    statusReason: row.status_reason ?? null,
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
    email: row.email,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAddress: row.location_address,
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
    email: string | null;
    role: AccountRole;
    status: AccountStatus;
    preferredLanguage: PreferredLanguage;
    latitude: number | null;
    longitude: number | null;
    locationAddress: string | null;
  }): Promise<Account> {
    const result = await this.pool.query(
      `INSERT INTO accounts (full_name, mobile_number, email, role, status, preferred_language, latitude, longitude, location_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        params.fullName,
        params.mobileNumber,
        params.email,
        params.role,
        params.status,
        params.preferredLanguage,
        params.latitude,
        params.longitude,
        params.locationAddress,
      ],
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
    email?: string;
    latitude?: number | null;
    longitude?: number | null;
    locationAddress?: string;
    preferredLanguage?: PreferredLanguage;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO otp_verifications (mobile_number, otp_hash, purpose, full_name, email, latitude, longitude, location_address, preferred_language, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        params.mobileNumber,
        params.otpHash,
        params.purpose,
        params.fullName ?? null,
        params.email ?? null,
        params.latitude ?? null,
        params.longitude ?? null,
        params.locationAddress ?? null,
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

  async createRefreshToken(params: { accountId: string; selector: string; tokenHash: string; expiresAt: Date }): Promise<void> {
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

  /** Signs the account out everywhere (used when the admin suspends or bans it). */
  async revokeAllRefreshTokens(accountId: string): Promise<void> {
    await this.pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL', [
      accountId,
    ]);
  }

  /** A suspension whose end has passed becomes active again (applied lazily on read). */
  async liftExpiredSuspension(accountId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE accounts SET status = 'active', suspended_until = NULL, status_reason = NULL, status_changed_at = now()
       WHERE id = $1 AND status = 'suspended' AND suspended_until IS NOT NULL AND suspended_until <= now()`,
      [accountId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // --- Admin ---

  async adminList(filter: AdminAccountListFilter): Promise<AdminAccountListResult> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      conditions.push(
        `(full_name ILIKE $${params.length} OR mobile_number ILIKE $${params.length} OR email ILIKE $${params.length})`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.pool.query(`SELECT COUNT(*) FROM accounts ${where}`, params);
    params.push(filter.limit, (filter.page - 1) * filter.limit);
    const rows = await this.pool.query(
      `SELECT * FROM accounts ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.rows.map(mapAccount), total: Number(count.rows[0].count), page: filter.page, limit: filter.limit };
  }

  async adminSetStatus(
    accountId: string,
    status: 'active' | 'suspended' | 'blocked',
    suspendedUntil: Date | null,
    reason: string | null,
  ): Promise<Account | null> {
    const result = await this.pool.query(
      `UPDATE accounts SET status = $2, suspended_until = $3, status_reason = $4, status_changed_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [accountId, status, suspendedUntil, reason],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async adminStats(): Promise<AdminAccountStats> {
    const result = await this.pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'active') AS active,
              COUNT(*) FILTER (WHERE status = 'suspended') AS suspended,
              COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
              COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS new_today
       FROM accounts WHERE role != 'admin'`,
    );
    const row = result.rows[0];
    return {
      total: Number(row.total),
      active: Number(row.active),
      suspended: Number(row.suspended),
      blocked: Number(row.blocked),
      newToday: Number(row.new_today),
    };
  }
}
