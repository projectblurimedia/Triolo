CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_role AS ENUM ('user', 'worker', 'business_owner', 'business_staff', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'pending_verification', 'suspended', 'blocked');

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  mobile_number VARCHAR(15) NOT NULL UNIQUE,
  role account_role NOT NULL,
  status account_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_mobile_number ON accounts (mobile_number);
CREATE INDEX idx_accounts_role ON accounts (role);
