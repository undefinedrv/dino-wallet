# 🦕 Dino Wallet — Virtual Wallet Microservice

A production-grade virtual wallet microservice implementing a **double-entry ledger** system with **pessimistic locking**, **idempotent transactions**, and **deadlock prevention**. Supports multiple asset types (Gold Coins, Diamonds, Loyalty Points) with TOPUP, BONUS, and SPEND transaction flows.

Built with Node.js, TypeScript, Express.js, PostgreSQL, TypeORM, and Docker.

---

### 🔗 Project Links

- **GitHub Repository**: [undefinedrv/dino-wallet](https://github.com/undefinedrv/dino-wallet)
- **Live Health Endpoint**: [dino-wallet.opshot.in/health](https://dino-wallet.opshot.in/health)
- **Postman Collection**: [View Collection](https://workmail-raghav-8993072.postman.co/workspace/Raghav-Bhati's-Workspace~c556ba2a-37ea-4e03-8474-642c538ec0a4/collection/52602666-331a9bc8-0e84-4ff5-9c32-e7deb6485e8c?action=share&creator=52602666)

### 🚀 Deployment

- **Hosting**: Railway
- **Database**: Neon PGSQL (Serverless Postgres)
- **Networking**: Cloudflare DNS

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

---

### Top Up

Add credits to a user's wallet from an external payment.

```
POST /api/wallets/topup
```

**Request Body:**
```json
{
  "userId": "1",
  "assetTypeId": "1",
  "amount": 500,
  "idempotencyKey": "topup-user1-gc-001",
  "description": "Top up via payment gateway"
}
```
---

### Bonus

Give free credits from the system to a user.

```
POST /api/wallets/bonus?userType=system
```

**Request Body:**
```json
{
  "userId": "1", // targeted user 
  "assetTypeId": "3", //loyalty points
  "amount": 100,
  "idempotencyKey": "bonus-user1-gc-001",
  "description": "Welcome bonus"
}
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
  "userId": "1",
  "assetTypeId": "2", // deduted from diamonds
  "amount": 200,
  "idempotencyKey": "spend-user1-gc-001",
  "description": "Purchased power-up"
}
```

---

### Get Balance

Get all wallet balances for a user.

```
GET /api/wallets/:userId/balance
```

> **Pro Tip:** Use `system` as the `:userId` to check all system wallet balances.

**Success Response (200):**
```json
[
  {
    "walletId": "1",
    "name": "Raghav Gold Coins",
    "assetType": "Gold Coins",
    "symbol": "GC",
    "balance": "1000"
  },
  {
    "walletId": "2",
    "name": "Raghav Diamonds",
    "assetType": "Diamonds",
    "symbol": "DC",
    "balance": "500"
  },
  {
    "walletId": "3",
    "name": "Raghav Loyalty Points",
    "assetType": "Loyalty Points",
    "symbol": "LP",
    "balance": "2000"
  }
]
```

---

### Get Transactions

Get paginated transaction history for a user.

```
GET /api/wallets/:userId/transactions?page=1&limit=10
```

> **Pro Tip:** Use `system` as the `:userId` to view the comprehensive audit trail for the entire system.

**Query Parameters:**
| Param | Default | Description |
|---|---|---|
| `page` | 1 | Page number |
| `limit` | 10 | Items per page |

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

## 🧪 Seeded Demo Data

| Entity | Details |
|---|---|
| **Asset Types** | Gold Coins (GC), Diamonds Coins (DC), Loyalty Points (LP) |
| **System Wallets** | 3 system wallets (one per asset type), balance = 0 |
| **Raghav (user-1)** | GC: 1000, DIA: 1000, LP: 0 |
| **Bhati (user-2)** | GC: 500, DIA: 500, LP: 0 |
