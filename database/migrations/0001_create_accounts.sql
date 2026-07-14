CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_role AS ENUM ('user', 'worker', 'business_owner', 'business_staff', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'pending_verification', 'suspended', 'blocked');

-- Enum (not free text) so adding a language later is `ALTER TYPE app_language ADD VALUE`,
-- with no migration of existing rows. See docs/localization.md.
CREATE TYPE app_language AS ENUM ('en', 'te');

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  mobile_number VARCHAR(15) NOT NULL UNIQUE,
  role account_role NOT NULL,
  status account_status NOT NULL DEFAULT 'active',
  preferred_language app_language NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_mobile_number ON accounts (mobile_number);
CREATE INDEX idx_accounts_role ON accounts (role);
