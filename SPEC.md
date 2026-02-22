# Wallet Service — Project Specification

## Tech Stack
- Runtime: Node.js with TypeScript
- Framework: Express.js
- Database: PostgreSQL
- ORM: TypeORM
- Containerization: Docker + Docker Compose

## Business Context
A closed-loop virtual wallet system for a gaming platform.
Users earn and spend virtual credits (Gold Coins, Diamonds, Loyalty Points).
Not real money. No transfers between users.

## Database Schema

### asset_types
- id: uuid (PK)
- name: varchar (unique) — e.g. "Gold Coins"
- symbol: varchar — e.g. "GC"
- isActive: boolean (default true)
- createdAt: timestamp

### wallets
- id: uuid (PK)
- userId: varchar (nullable — null means system wallet)
- name: varchar — e.g. "user-1-gold", "treasury-gold"
- type: enum ['user', 'system']
- assetTypeId: uuid (FK → asset_types)
- balance: bigint (default 0, never negative)
- createdAt: timestamp

### transactions
- id: uuid (PK)
- idempotencyKey: varchar (unique)
- type: enum ['TOPUP', 'BONUS', 'SPEND']
- status: enum ['PENDING', 'SUCCESS', 'FAILED']
- amount: bigint
- debitWalletId: uuid (FK → wallets)
- creditWalletId: uuid (FK → wallets)
- description: varchar (nullable)
- createdAt: timestamp

### ledger_entries
- id: uuid (PK)
- transactionId: uuid (FK → transactions)
- walletId: uuid (FK → wallets)
- entryType: enum ['DEBIT', 'CREDIT']
- amount: bigint
- balanceAfter: bigint
- createdAt: timestamp

## Three Core Flows

### 1. TOPUP
- Debit: Treasury wallet (system)
- Credit: User wallet
- Trigger: User purchases credits with real money

### 2. BONUS
- Debit: Bonus Pool wallet (system)
- Credit: User wallet
- Trigger: System gives free credits (referral, reward)

### 3. SPEND
- Debit: User wallet
- Credit: Revenue wallet (system)
- Trigger: User buys something in-app
- Constraint: User balance must be >= amount, else reject

## Critical Rules
1. Every transaction = exactly 2 ledger_entries (one DEBIT, one CREDIT)
2. Balance can NEVER go negative
3. idempotencyKey must be checked FIRST inside every transaction
4. All 3 flows use SELECT FOR UPDATE (TypeORM pessimistic_write lock)
5. Always lock wallets in sorted UUID order to prevent deadlocks
6. All balance math happens inside a single DB transaction (atomic)

## System Wallets (seeded at startup)
- Treasury Gold Coins — source for TOPUP of Gold Coins
- Treasury Diamonds — source for TOPUP of Diamonds
- Treasury Loyalty Points — source for TOPUP of Loyalty Points
- Bonus Pool Gold Coins — source for BONUS of Gold Coins
- Bonus Pool Diamonds — source for BONUS of Diamonds
- Bonus Pool Loyalty Points — source for BONUS of Loyalty Points
- Revenue Gold Coins — destination for SPEND of Gold Coins
- Revenue Diamonds — destination for SPEND of Diamonds
- Revenue Loyalty Points — destination for SPEND of Loyalty Points

## Seed Users
- User 1 (userId: "user-1", name: "Alice") 
  - Gold Coins wallet: 1000
  - Diamonds wallet: 500
  - Loyalty Points wallet: 2000
- User 2 (userId: "user-2", name: "Bob")
  - Gold Coins wallet: 500
  - Diamonds wallet: 100
  - Loyalty Points wallet: 800

## API Endpoints

POST /api/wallets/topup
Body: { userId, assetTypeId, amount, idempotencyKey }
Response: transaction object

POST /api/wallets/bonus
Body: { userId, assetTypeId, amount, idempotencyKey, description? }
Response: transaction object

POST /api/wallets/spend
Body: { userId, assetTypeId, amount, idempotencyKey, description? }
Response: transaction object
Error: 422 if insufficient balance

GET /api/wallets/:userId/balance
Response: array of { assetType, balance } for all asset types

GET /api/wallets/:userId/transactions
Response: paginated transaction history with ledger entries
 
GET /health
Response: { status: "ok" }

## Error Handling
- 400: Missing required fields
- 404: User wallet not found
- 409: Idempotency key conflict (different params, same key)
- 422: Insufficient balance
- 500: Internal server error

## Environment Variables
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wallet_db
PORT=3000
NODE_ENV=development
```

---

## Phase-by-Phase Prompts

Give these to Antigravity **one at a time**, in order.

---

### Phase 1 — Project Scaffold
```
Read the SPEC.md file in this repo completely before doing anything.

Set up a Node.js TypeScript project with the following:
- package.json with these dependencies: express, typeorm, pg, reflect-metadata, dotenv
- devDependencies: typescript, ts-node, nodemon, @types/express, @types/node
- tsconfig.json with strict mode, decorators enabled (emitDecoratorMetadata: true, experimentalDecorators: true)
- nodemon.json to run src/app.ts with ts-node
- .env.example with all env vars from the spec
- .gitignore (node_modules, .env, dist)
- src/app.ts — Express app setup with JSON middleware, health endpoint GET /health, and error handler
- src/config/database.ts — TypeORM DataSource using env vars, with synchronize: false

Do not create any entities yet. Just the scaffold.
```

---

### Phase 2 — Entities
```
Read SPEC.md completely.

Create all 4 TypeORM entities in src/entities/ exactly matching the schema in SPEC.md:
- AssetType.ts
- Wallet.ts  
- Transaction.ts
- LedgerEntry.ts

Use uuid as primary keys (use @PrimaryGeneratedColumn('uuid')).
Use proper TypeORM decorators (@Entity, @Column, @ManyToOne, @CreateDateColumn).
For enum columns use TypeORM's enum option in @Column.
Wallet.balance must use { type: 'bigint' } and default 0.
Add a unique composite index on wallets (userId, assetTypeId) so one user can't have duplicate wallets per asset type.

Do not create migrations or seed yet.
```

---

### Phase 3 — Migrations and Seed
```
Read SPEC.md completely.

Do the following two things:

1. Create a TypeORM migration file in src/migrations/ that creates all 4 tables 
(asset_types, wallets, transactions, ledger_entries) with all constraints, 
foreign keys, and indexes as defined in SPEC.md.

2. Create src/seed.ts — a standalone script that:
- Connects to the database
- Inserts 3 asset types: Gold Coins (GC), Diamonds (DIA), Loyalty Points (LP)
- Inserts 9 system wallets (Treasury, Bonus Pool, Revenue — one per asset type) with balance 999999999
- Inserts wallets for user-1 (Alice) and user-2 (Bob) with starting balances from SPEC.md
- Uses INSERT ... ON CONFLICT DO NOTHING so it is safe to run multiple times
- Disconnects and exits after seeding

Also create a seed.sql file that does the exact same thing as seed.ts but in raw SQL,
so reviewers can run it directly against the database if they want.
```

---

### Phase 4 — Core Service
```
Read SPEC.md completely. This is the most critical file in the project.

Create src/services/wallet.service.ts with a WalletService class containing these methods:

1. topUp(userId, assetTypeId, amount, idempotencyKey)
2. bonus(userId, assetTypeId, amount, idempotencyKey, description?)
3. spend(userId, assetTypeId, amount, idempotencyKey, description?)
4. getBalance(userId) — returns all wallets for user with asset type name
5. getTransactions(userId, page, limit) — paginated, includes ledger entries

For topUp, bonus, and spend follow this EXACT pattern inside AppDataSource.transaction():
  Step 1: Check idempotencyKey in transactions table — if found return existing transaction immediately
  Step 2: Find the two wallets involved (user wallet + correct system wallet based on flow type)
  Step 3: Lock both wallets using pessimistic_write (SELECT FOR UPDATE)
         IMPORTANT: Always sort wallet IDs alphabetically before locking — deadlock prevention
  Step 4: For spend only — check userWallet.balance >= amount, throw error if not
  Step 5: Update both wallet balances (debit one, credit the other)
  Step 6: Save both wallets
  Step 7: Create and save Transaction record with status SUCCESS
  Step 8: Create and save 2 LedgerEntry records (one DEBIT, one CREDIT) with balanceAfter snapshots
  Step 9: Return the transaction

Use TypeORM's manager.createQueryBuilder().setLock('pessimistic_write') for locking.
Never use raw SQL. Use TypeORM manager throughout (not the repository pattern).
```

---

### Phase 5 — Controller and Routes
```
Read SPEC.md completely.

Create src/controllers/wallet.controller.ts with an Express controller class.
Create src/routes/wallet.routes.ts with all routes from SPEC.md.
Wire the routes into src/app.ts under /api prefix.

Controller methods:
- topUp: validate userId, assetTypeId, amount, idempotencyKey are present → call service → return 200 with transaction
- bonus: same validation → call service → return 200
- spend: same validation → call service → return 200, catch INSUFFICIENT_BALANCE error and return 422
- getBalance: call service → return 200 with balance array
- getTransactions: call service with page/limit query params (default page=1, limit=10) → return 200

Add a global error handler middleware in src/middlewares/errorHandler.ts that:
- Catches any unhandled error
- Returns { error: message, code: errorCode } in JSON
- Returns 500 for unknown errors
- Returns appropriate status codes for known errors
```

---

### Phase 6 — Docker Setup
```
Read SPEC.md completely.

Create the following Docker files:

1. Dockerfile:
- Use node:20-alpine as base
- Copy package files, run npm install
- Copy source
- Expose port 3000
- CMD runs migration then starts the app

2. docker-compose.yml with 3 services:
- postgres: image postgres:15, with POSTGRES_DB=wallet_db, POSTGRES_USER=postgres, POSTGRES_PASSWORD=postgres, volume for persistence, healthcheck
- app: builds from Dockerfile, depends_on postgres with condition service_healthy, environment variables from .env, ports 3000:3000
- seeder: same image as app, depends_on app, runs the seed script once and exits (restart: no)

3. A shell script docker-entrypoint.sh that:
- Waits for postgres to be ready
- Runs TypeORM migrations
- Starts the Node app

Make sure docker compose up --build brings everything up with zero manual steps.
```

---

### Phase 7 — README
```
Read SPEC.md completely. Read all files in this repo.

Write a comprehensive README.md covering:

1. Project Overview — what this service does in 2-3 sentences
2. Tech Stack — Node.js, TypeScript, Express, TypeORM, PostgreSQL, Docker. For each explain WHY it was chosen (1 sentence each)
3. Architecture — explain double-entry ledger design and why it was chosen over simple balance updates
4. How to Run:
   - With Docker (recommended): docker compose up --build
   - Without Docker: npm install, set up .env, run migrations, run seed, npm run dev
5. API Documentation — table with Method, Endpoint, Body, Response for all endpoints, with example curl commands for each
6. Concurrency Strategy — explain SELECT FOR UPDATE and why it prevents race conditions
7. Deadlock Prevention — explain sorted wallet ID locking strategy clearly
8. Idempotency — explain how idempotencyKey works and why it matters
9. Double Entry Ledger — explain the two ledger entries per transaction and how it enables auditability

Write it clearly. Use tables for API docs. Use code blocks for curl examples.
```

---

## After All Phases — Final Prompt
```
Review the entire codebase.

Check the following and fix any issues:
1. Does docker compose up --build work end to end with zero errors?
2. Does the seed script run without errors and insert all data from SPEC.md?
3. Do all 5 API endpoints return correct responses?
4. Does spend return 422 when balance is insufficient?
5. Does sending the same idempotencyKey twice return the same response without duplicate DB entries?
6. Are both ledger entries being created for every transaction?
7. Is SELECT FOR UPDATE being used in all 3 transaction flows?
8. Are wallet IDs being sorted before locking?

Fix anything that is broken. Do not add new features.