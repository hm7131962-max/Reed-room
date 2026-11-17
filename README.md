# RED ROOM — Backend + two independent PostgreSQL databases

## Architecture
This backend uses **two physically separate PostgreSQL databases**:

1. `CUSTOMER_DATABASE_URL` — customer accounts, banks, branches, password hashes, balances, admin users, balance audit events and transfer ledger.
2. `BENEFICIARY_DATABASE_URL` — beneficiary directory only. It does not require a beneficiary to be registered as a RED ROOM customer.

The API connects to both. During a simulated transfer it reads the beneficiary from database 2, then atomically debits the sender and writes a beneficiary snapshot plus transfer record in database 1. The snapshot keeps the transfer history readable even if a beneficiary is later edited or removed.

## Run locally
Requirements: Node.js 20+ and two PostgreSQL databases. They can be two databases on one PostgreSQL server, but use distinct database names and credentials where possible.

1. Create two empty databases: `red_room_customers` and `red_room_beneficiaries`.
2. Copy `.env.example` to `.env`.
3. Set `CUSTOMER_DATABASE_URL` and `BENEFICIARY_DATABASE_URL` to their respective connection strings.
4. Set a random `JWT_SECRET` (at least 32 characters), a unique `ADMIN_USERNAME`, and a strong `ADMIN_PASSWORD`.
5. Run `npm install`, then `npm start`.
6. Open `GET /api/health`. It reports whether both databases are connected. The schema is initialized automatically.

## API summary
- `POST /api/auth/admin` — `{username,password}`
- `POST /api/auth/customer` — `{accountNumber,password}`
- Admin routes (Bearer admin token): `/api/admin/banks`, `/api/admin/branches`, `/api/admin/customers`, `/api/admin/customers/:id/balance`, `/api/admin/beneficiaries`
- Customer routes (Bearer customer token): `/api/customer/me`, `/api/customer/beneficiaries/:accountNumber`, `/api/customer/transfers`
- Customer creation: `{bankId,branchId,accountNumber,fullName,accountType,password,balance,status}`

Passwords are stored as bcrypt hashes. Plaintext passwords are never returned. Customer and beneficiary records are never automatically copied between databases.

## Deploy
Deploy the `server` directory as a Node web service. Create/provision **two** PostgreSQL databases, then add their connection strings as private environment variables named `CUSTOMER_DATABASE_URL` and `BENEFICIARY_DATABASE_URL`. Also set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, and `ALLOWED_ORIGINS`. Never commit `.env` or database credentials.

## Important
This is a simulated ledger for development/testing. It is not a bank, payment processor, regulated financial service, or connection to real bank rails. Transfers do not send or credit real funds. Do not enter real customer credentials or financial data. Have a qualified security engineer review the system before any production use.
