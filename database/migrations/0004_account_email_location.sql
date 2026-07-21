-- Every self-registered account is now a plain 'user' that captures email and a
-- location at registration (GPS auto-detect, reverse-geocoded to a readable address,
-- or a manual address if the user declines/lacks GPS). Nullable at the DB level even
-- though the API requires them for new registrations, since a migration can't backfill
-- values for any rows that predate this change.
ALTER TABLE accounts
  ADD COLUMN email TEXT,
  ADD COLUMN latitude DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION,
  ADD COLUMN location_address TEXT;

CREATE INDEX idx_accounts_email ON accounts (email);

-- otp_verifications carries the same fields as accounts for the duration of the
-- registration OTP flow (same pattern as the existing full_name/role columns).
ALTER TABLE otp_verifications
  ADD COLUMN email TEXT,
  ADD COLUMN latitude DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION,
  ADD COLUMN location_address TEXT;
