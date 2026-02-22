# 🦕 Dino Wallet — Virtual Wallet Microservice

A production-grade virtual wallet microservice implementing a **double-entry ledger** system with **pessimistic locking**, **idempotent transactions**, and **deadlock prevention**. Supports multiple asset types (Gold Coins, Diamonds, Loyalty Points) with TOPUP, BONUS, and SPEND transaction flows.

Built with Node.js, TypeScript, Express.js, PostgreSQL, TypeORM, and Docker.

---

## 📋 Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture](#architecture)
3. [System Wallet Design](#system-wallet-design)
4. [How to Run](#how-to-run)
5. [API Documentation](#api-documentation)
6. [Concurrency Strategy](#concurrency-strategy)
7. [Deadlock Prevention](#deadlock-prevention)
8. [Idempotency](#idempotency)
9. [Double-Entry Ledger](#double-entry-ledger)

---

## 🛠 Tech Stack

| Technology | Why |
|---|---|
| **Node.js 22 LTS** | Stable, performant JavaScript runtime for building scalable server applications |
| **TypeScript 5.7** | Type safety catches bugs at compile time and improves developer experience |
| **Express.js 4** | Mature, minimal web framework — battle-tested in production environments |
| **PostgreSQL 17** | ACID-compliant relational database with strong support for transactions and locking |
| **TypeORM 0.3** | TypeScript-first ORM with migration support, entity decorators, and transaction management |
| **Docker + Compose** | Reproducible, isolated environments — one command to run the entire stack |

---

## 🏗 Architecture

### Double-Entry Ledger

Every financial transaction in this system creates **exactly 2 ledger entries** — one DEBIT and one CREDIT. This is the same accounting principle used by banks and financial institutions worldwide.

For every transaction:
- **DEBIT entry**: Records the wallet being debited, the amount, and its balance after
- **CREDIT entry**: Records the wallet being credited, the amount, and its balance after

This ensures:
- The sum of all debits always equals the sum of all credits
- Every balance change is fully traceable and auditable
- Balances can be independently verified by replaying ledger entries

---

## 🏦 System Wallet Design

There are **3 system wallets** — one per asset type:
- System Gold Coins
- System Diamonds
- System Loyalty Points

**All system wallets start at balance 0.** They are accounting destinations, not a source of funds.

### Money Flow

| Flow | User Wallet | System Wallet | Explanation |
|---|---|---|---|
| **TOPUP** | ↑ increases | ↑ increases | External payment comes in — new credits enter the system |
| **BONUS** | ↑ increases | ↓ decreases | System gives free credits — system spends from its balance |
| **SPEND** | ↓ decreases | ↑ increases | User buys something — credits flow back to the system |

System wallets naturally grow as users top up and spend.
Bonuses can only be given if the system wallet has sufficient balance (from prior top-ups and spends).

---

## 🚀 How to Run

### With Docker (Recommended)

```bash
cd wallet-service
docker compose up --build
```

That's it. This will:
1. Start PostgreSQL and wait for it to be healthy
2. Run all migrations automatically
3. Seed the database with demo data
4. Start the API on **http://localhost:3000**

### Without Docker

Prerequisites: Node.js 22+, PostgreSQL 17+

```bash
cd wallet-service

# Install dependencies
npm install

# Copy env and fill in your PostgreSQL URL
cp .env.example .env

# Run migrations
npm run migration:run

# Seed the database
npm run seed

# Start the dev server
npm run dev
```

The API will be available at **http://localhost:3000**

### Verify it's running

```bash
curl http://localhost:3000/health
```

Response:
```json
{ "status": "ok", "timestamp": "2026-02-22T14:00:00.000Z" }
```

---

## 📡 API Documentation

Base URL: `http://localhost:3000`

### Health Check

```
GET /health
```

**Response:**
```json
{ "status": "ok", "timestamp": "2026-02-22T14:00:00.000Z" }
```

**curl:**
```bash
curl http://localhost:3000/health
```

---

### Top Up

Add credits to a user's wallet from an external payment.

```
POST /api/wallets/topup
```

**Request Body:**
```json
{
  "userId": "user-1",
  "assetTypeId": "a0000000-0000-0000-0000-000000000001",
  "amount": 500,
  "idempotencyKey": "topup-user1-gc-001",
  "description": "Top up via payment gateway"
}
```

**Success Response (200):**
```json
{
  "id": "txn-uuid",
  "idempotencyKey": "topup-user1-gc-001",
  "type": "TOPUP",
  "status": "SUCCESS",
  "amount": "500",
  "debitWalletId": "w0000000-0000-0000-0000-000000000001",
  "creditWalletId": "w0000000-0000-0000-0000-000000000011",
  "description": "Top up via payment gateway",
  "createdAt": "2026-02-22T14:00:00.000Z",
  "ledgerEntries": [
    {
      "id": "entry-uuid-1",
      "transactionId": "txn-uuid",
      "walletId": "w0000000-0000-0000-0000-000000000001",
      "entryType": "DEBIT",
      "amount": "500",
      "balanceAfter": "500",
      "createdAt": "2026-02-22T14:00:00.000Z"
    },
    {
      "id": "entry-uuid-2",
      "transactionId": "txn-uuid",
      "walletId": "w0000000-0000-0000-0000-000000000011",
      "entryType": "CREDIT",
      "amount": "500",
      "balanceAfter": "1500",
      "createdAt": "2026-02-22T14:00:00.000Z"
    }
  ]
}
```

**Error Response (400):**
```json
{ "error": "Missing required fields: userId, assetTypeId, amount, idempotencyKey", "code": "VALIDATION" }
```

**curl:**
```bash
curl -X POST http://localhost:3000/api/wallets/topup \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "assetTypeId": "a0000000-0000-0000-0000-000000000001",
    "amount": 500,
    "idempotencyKey": "topup-user1-gc-001",
    "description": "Top up via payment gateway"
  }'
```

---

### Bonus

Give free credits from the system to a user.

```
POST /api/wallets/bonus
```

**Request Body:**
```json
{
  "userId": "user-1",
  "assetTypeId": "a0000000-0000-0000-0000-000000000001",
  "amount": 100,
  "idempotencyKey": "bonus-user1-gc-001",
  "description": "Welcome bonus"
}
```

**Success Response (200):**
```json
{
  "id": "txn-uuid",
  "idempotencyKey": "bonus-user1-gc-001",
  "type": "BONUS",
  "status": "SUCCESS",
  "amount": "100",
  "debitWalletId": "w0000000-0000-0000-0000-000000000001",
  "creditWalletId": "w0000000-0000-0000-0000-000000000011",
  "description": "Welcome bonus",
  "createdAt": "2026-02-22T14:00:00.000Z",
  "ledgerEntries": [...]
}
```

**Error Response (422 — insufficient system balance):**
```json
{ "error": "System wallet has insufficient balance for bonus", "code": "INSUFFICIENT_SYSTEM_BALANCE" }
```

**curl:**
```bash
curl -X POST http://localhost:3000/api/wallets/bonus \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "assetTypeId": "a0000000-0000-0000-0000-000000000001",
    "amount": 100,
    "idempotencyKey": "bonus-user1-gc-001",
    "description": "Welcome bonus"
  }'
```

---

### Spend

Deduct credits from a user's wallet for an in-app purchase.

```
POST /api/wallets/spend
```

**Request Body:**
```json
{
  "userId": "user-1",
  "assetTypeId": "a0000000-0000-0000-0000-000000000001",
  "amount": 200,
  "idempotencyKey": "spend-user1-gc-001",
  "description": "Purchased power-up"
}
```

**Success Response (200):**
```json
{
  "id": "txn-uuid",
  "idempotencyKey": "spend-user1-gc-001",
  "type": "SPEND",
  "status": "SUCCESS",
  "amount": "200",
  "debitWalletId": "w0000000-0000-0000-0000-000000000011",
  "creditWalletId": "w0000000-0000-0000-0000-000000000001",
  "description": "Purchased power-up",
  "createdAt": "2026-02-22T14:00:00.000Z",
  "ledgerEntries": [...]
}
```

**Error Response (422 — insufficient balance):**
```json
{ "error": "Insufficient balance", "code": "INSUFFICIENT_BALANCE" }
```

**curl:**
```bash
curl -X POST http://localhost:3000/api/wallets/spend \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "assetTypeId": "a0000000-0000-0000-0000-000000000001",
    "amount": 200,
    "idempotencyKey": "spend-user1-gc-001",
    "description": "Purchased power-up"
  }'
```

---

### Get Balance

Get all wallet balances for a user.

```
GET /api/wallets/:userId/balance
```

**Success Response (200):**
```json
[
  {
    "walletId": "w0000000-0000-0000-0000-000000000011",
    "name": "Alice Gold Coins",
    "assetType": "Gold Coins",
    "symbol": "GC",
    "balance": "1000"
  },
  {
    "walletId": "w0000000-0000-0000-0000-000000000012",
    "name": "Alice Diamonds",
    "assetType": "Diamonds",
    "symbol": "DIA",
    "balance": "500"
  },
  {
    "walletId": "w0000000-0000-0000-0000-000000000013",
    "name": "Alice Loyalty Points",
    "assetType": "Loyalty Points",
    "symbol": "LP",
    "balance": "2000"
  }
]
```

**curl:**
```bash
curl http://localhost:3000/api/wallets/user-1/balance
```

---

### Get Transactions

Get paginated transaction history for a user.

```
GET /api/wallets/:userId/transactions?page=1&limit=10
```

**Query Parameters:**
| Param | Default | Description |
|---|---|---|
| `page` | 1 | Page number |
| `limit` | 10 | Items per page |

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "txn-uuid",
      "idempotencyKey": "topup-user1-gc-001",
      "type": "TOPUP",
      "status": "SUCCESS",
      "amount": "500",
      "debitWalletId": "...",
      "creditWalletId": "...",
      "description": "Top up via payment gateway",
      "createdAt": "2026-02-22T14:00:00.000Z",
      "ledgerEntries": [...]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

**curl:**
```bash
curl "http://localhost:3000/api/wallets/user-1/transactions?page=1&limit=10"
```

---

## 🔒 Concurrency Strategy

This service uses **PostgreSQL `SELECT ... FOR UPDATE`** (pessimistic write locks) via TypeORM's `setLock('pessimistic_write')` to prevent race conditions.

**How it works in plain English:**

When two requests try to modify the same wallet at the same time, PostgreSQL ensures only one can proceed. The first request locks the wallet row. The second request is forced to wait in a queue until the first request completes its transaction. This guarantees that:
- Balance reads are always accurate (no stale data)
- Balance updates are atomic (no lost updates)
- Two concurrent spend requests can't both succeed if only enough balance exists for one

This is the gold standard for financial systems where data consistency is non-negotiable.

---

## 🔐 Deadlock Prevention

**The problem:** If Request A locks Wallet 1 then tries to lock Wallet 2, while simultaneously Request B locks Wallet 2 then tries to lock Wallet 1, they deadlock — each is waiting for the other.

**The solution:** Before locking, we sort the two wallet IDs alphabetically and always lock them in that sorted order. This means every request that involves the same two wallets will always lock them in the same sequence, making deadlocks impossible.

```
// Both requests will lock in this order:
// 1. wallet-aaaa (alphabetically first)
// 2. wallet-zzzz (alphabetically second)
```

This consistent-ordering technique is a well-known pattern in database programming and distributed systems.

---

## 🔑 Idempotency

Every transaction request requires a unique `idempotencyKey`. This prevents duplicate transactions from network retries, double-clicks, or system failures.

**How it works:**

1. Client generates a unique key (e.g., `"topup-user1-gc-001"`) and includes it in the request
2. Before processing, the service checks if a transaction with that key already exists
3. If found → returns the existing transaction immediately (no new processing)
4. If not found → processes the transaction normally

**Why it matters:**
- If a network timeout occurs and the client retries, the same `idempotencyKey` ensures the transaction isn't processed twice
- The `idempotencyKey` column has a `UNIQUE` constraint in the database, providing a second safety net at the database level
- This is essential for financial systems where processing the same payment twice would be catastrophic

---

## 📒 Double-Entry Ledger

Every transaction in the system creates exactly **2 ledger entries**:

| Entry | Type | Wallet | Records |
|---|---|---|---|
| Entry 1 | DEBIT | The debited wallet | Amount withdrawn, balance after |
| Entry 2 | CREDIT | The credited wallet | Amount deposited, balance after |

### Example: User spends 200 Gold Coins

| Entry | Type | Wallet | Amount | Balance After |
|---|---|---|---|---|
| 1 | DEBIT | User Wallet | 200 | 800 (was 1000) |
| 2 | CREDIT | System Wallet | 200 | 200 (was 0) |

**Benefits:**
- **Auditability**: Every balance change is recorded with a full trail
- **Verifiability**: Wallet balance can be independently calculated by summing credits minus debits
- **Debugging**: If a balance looks wrong, the ledger entries show exactly what happened
- **Compliance**: Meets accounting standards for financial record-keeping

---

## 📁 Project Structure

```
wallet-service/
├── src/
│   ├── config/
│   │   └── database.ts          # TypeORM DataSource configuration
│   ├── entities/
│   │   ├── AssetType.ts         # Asset type entity (Gold Coins, Diamonds, etc.)
│   │   ├── Wallet.ts            # Wallet entity (user & system wallets)
│   │   ├── Transaction.ts       # Transaction entity (TOPUP, BONUS, SPEND)
│   │   └── LedgerEntry.ts       # Ledger entry entity (DEBIT, CREDIT)
│   ├── services/
│   │   └── wallet.service.ts    # Core business logic with locking & ledger
│   ├── controllers/
│   │   └── wallet.controller.ts # Request validation & response formatting
│   ├── routes/
│   │   └── wallet.routes.ts     # Express route definitions
│   ├── middlewares/
│   │   └── errorHandler.ts      # Global error handler
│   ├── migrations/
│   │   └── 1708000000000-InitialSchemaAndSeed.ts  # Schema + seed data
│   ├── seed.ts                  # Standalone seed script
│   └── app.ts                   # Express app entry point
├── seed.sql                     # Raw SQL seed (identical to seed.ts)
├── Dockerfile                   # Multi-stage Docker build
├── docker-compose.yml           # Full stack: PostgreSQL + API
├── docker-entrypoint.sh         # Runs migrations → seed → server
├── .env.example                 # Environment variable template
├── nodemon.json                 # Dev server config
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies & scripts
└── README.md                    # This file
```

---

## 🧪 Seeded Demo Data

| Entity | Details |
|---|---|
| **Asset Types** | Gold Coins (GC), Diamonds (DIA), Loyalty Points (LP) |
| **System Wallets** | 3 wallets (one per asset type), balance = 0 |
| **Alice (user-1)** | GC: 1000, DIA: 500, LP: 2000 |
| **Bob (user-2)** | GC: 500, DIA: 100, LP: 800 |

### Quick Test After Starting

```bash
# Check Alice's balance
curl http://localhost:3000/api/wallets/user-1/balance

# Top up Alice with 500 Gold Coins
curl -X POST http://localhost:3000/api/wallets/topup \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","assetTypeId":"a0000000-0000-0000-0000-000000000001","amount":500,"idempotencyKey":"test-topup-001"}'

# Alice spends 200 Gold Coins
curl -X POST http://localhost:3000/api/wallets/spend \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","assetTypeId":"a0000000-0000-0000-0000-000000000001","amount":200,"idempotencyKey":"test-spend-001"}'

# Check Alice's updated balance
curl http://localhost:3000/api/wallets/user-1/balance

# View Alice's transaction history
curl "http://localhost:3000/api/wallets/user-1/transactions?page=1&limit=10"
```
