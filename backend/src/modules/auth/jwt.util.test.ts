import {
  compareRefreshVerifier,
  generateRefreshToken,
  hashRefreshVerifier,
  parseRefreshToken,
  refreshExpiryToDate,
  signAccessToken,
  verifyAccessToken,
} from './jwt.util';

describe('jwt.util - access tokens', () => {
  it('signs and verifies a valid access token round-trip', () => {
    const payload = { accountId: 'acc-1', role: 'user' as const, status: 'active' as const };
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);

    expect(decoded.accountId).toBe(payload.accountId);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.status).toBe(payload.status);
  });

  it('throws when verifying a tampered token', () => {
    const token = signAccessToken({ accountId: 'acc-1', role: 'user', status: 'active' });
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});

describe('jwt.util - refresh tokens', () => {
  it('generates a token in "selector.verifier" format that round-trips through parsing', () => {
    const { token, selector, verifier } = generateRefreshToken();
    const parsed = parseRefreshToken(token);

    expect(parsed).not.toBeNull();
    expect(parsed?.selector).toBe(selector);
    expect(parsed?.verifier).toBe(verifier);
  });

  it('returns null when parsing a malformed token', () => {
    expect(parseRefreshToken('not-a-valid-token')).toBeNull();
    expect(parseRefreshToken('too.many.parts')).toBeNull();
    expect(parseRefreshToken('.missingselector')).toBeNull();
  });

  it('hashes a verifier and verifies it correctly, rejecting a wrong one', async () => {
    const { verifier } = generateRefreshToken();
    const hash = await hashRefreshVerifier(verifier);

    await expect(compareRefreshVerifier(verifier, hash)).resolves.toBe(true);
    await expect(compareRefreshVerifier('wrong-verifier', hash)).resolves.toBe(false);
  });

  it('computes a refresh expiry date in the future', () => {
    const expiry = refreshExpiryToDate();
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });
});
