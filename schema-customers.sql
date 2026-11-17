CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS customer_data;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE TABLE IF NOT EXISTS customer_data.banks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code VARCHAR(40) UNIQUE NOT NULL,
 name VARCHAR(140) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customer_data.branches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bank_id UUID NOT NULL REFERENCES customer_data.banks(id),
 name VARCHAR(140) NOT NULL, UNIQUE(bank_id,name), UNIQUE(id,bank_id)
);
CREATE TABLE IF NOT EXISTS customer_data.customers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bank_id UUID NOT NULL REFERENCES customer_data.banks(id),
 branch_id UUID NOT NULL, account_number VARCHAR(32) UNIQUE NOT NULL,
 full_name VARCHAR(160) NOT NULL, account_type VARCHAR(40) NOT NULL DEFAULT 'savings', password_hash TEXT NOT NULL,
 balance NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(balance >= 0),
 status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK(status IN ('active','frozen','disabled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(branch_id,bank_id) REFERENCES customer_data.branches(id,bank_id)
);
CREATE TABLE IF NOT EXISTS operations.admins (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username VARCHAR(80) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS operations.transfers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sender_customer_id UUID NOT NULL REFERENCES customer_data.customers(id),
 sender_account VARCHAR(32) NOT NULL, beneficiary_id UUID NOT NULL, beneficiary_account VARCHAR(32) NOT NULL,
 beneficiary_name VARCHAR(160) NOT NULL, beneficiary_bank VARCHAR(140) NOT NULL,
 beneficiary_branch VARCHAR(140) NOT NULL, beneficiary_type VARCHAR(40) NOT NULL,
 amount NUMERIC(18,2) NOT NULL CHECK(amount > 0), reference VARCHAR(40) UNIQUE NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'completed', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS operations.balance_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id UUID NOT NULL REFERENCES customer_data.customers(id),
 admin_id UUID REFERENCES operations.admins(id), amount NUMERIC(18,2) NOT NULL,
 balance_after NUMERIC(18,2) NOT NULL, reason VARCHAR(240) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO customer_data.banks(code,name) VALUES
 ('khartoum','بنك الخرطوم'),('omdurman','بنك أم درمان الوطني'),('faisal','بنك فيصل الإسلامي'),
 ('nilein','بنك النيلين'),('islamic','البنك الإسلامي السوداني') ON CONFLICT(code) DO NOTHING;
INSERT INTO customer_data.branches(bank_id,name)
SELECT b.id,x.branch_name FROM customer_data.banks b JOIN (VALUES
 ('khartoum','الخرطوم - الرياض'),('khartoum','الخرطوم - السوق العربي'),('khartoum','بحري'),
 ('omdurman','أم درمان - السوق'),('omdurman','أم درمان - الثورة'),('omdurman','أم درمان - بانت'),
 ('faisal','الخرطوم - فيصل'),('faisal','مدني - فيصل'),('nilein','الخرطوم - النيلين'),
 ('nilein','بورتسودان'),('islamic','الخرطوم - الإسلامي'),('islamic','كسلا')
) AS x(bank_code,branch_name) ON x.bank_code=b.code ON CONFLICT(bank_id,name) DO NOTHING;
