import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '@/config/env';
import { AccessTokenPayload } from './interfaces';

const SALT_ROUNDS = 10;
const SELECTOR_BYTES = 12;
const VERIFIER_BYTES = 32;

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.jwt.accessExpiry as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.accessSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

/**
 * Refresh tokens use a selector/verifier split so the DB can look up the record
 * by selector (indexed, non-secret) without needing to bcrypt-compare against every row.
 * Only the verifier half is secret and is stored hashed.
 */
export interface GeneratedRefreshToken {
  token: string;
  selector: string;
  verifier: string;
}

export function generateRefreshToken(): GeneratedRefreshToken {
  const selector = crypto.randomBytes(SELECTOR_BYTES).toString('hex');
  const verifier = crypto.randomBytes(VERIFIER_BYTES).toString('hex');
  return { token: `${selector}.${verifier}`, selector, verifier };
}

export function parseRefreshToken(token: string): { selector: string; verifier: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { selector: parts[0], verifier: parts[1] };
}

export function hashRefreshVerifier(verifier: string): Promise<string> {
  return bcrypt.hash(verifier, SALT_ROUNDS);
}

export function compareRefreshVerifier(verifier: string, verifierHash: string): Promise<boolean> {
  return bcrypt.compare(verifier, verifierHash);
}

export function refreshExpiryToDate(): Date {
  const match = /^(\d+)([smhd])$/.exec(env.jwt.refreshExpiry);
  if (!match) {
    throw new Error(`Invalid JWT_REFRESH_EXPIRY format: ${env.jwt.refreshExpiry}`);
  }
  const [, amountStr, unit] = match;
  const amount = Number(amountStr);
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + amount * unitMs[unit]);
}
