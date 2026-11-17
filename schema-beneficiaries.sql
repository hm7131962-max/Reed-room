CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS beneficiary_data;
CREATE TABLE IF NOT EXISTS beneficiary_data.beneficiaries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_number VARCHAR(32) NOT NULL,
 full_name VARCHAR(160) NOT NULL, bank_name VARCHAR(140) NOT NULL,
 branch_name VARCHAR(140) NOT NULL, account_type VARCHAR(40) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(account_number,bank_name)
);
CREATE INDEX IF NOT EXISTS beneficiaries_account_idx ON beneficiary_data.beneficiaries(account_number);
