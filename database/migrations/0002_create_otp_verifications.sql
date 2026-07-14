CREATE TYPE otp_purpose AS ENUM ('registration', 'login');

CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_number VARCHAR(15) NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose otp_purpose NOT NULL,
  full_name TEXT,
  role account_role,
  preferred_language app_language,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempt_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_mobile_purpose ON otp_verifications (mobile_number, purpose, consumed_at);
