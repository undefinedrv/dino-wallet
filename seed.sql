-- ============================================================
-- seed.sql — Raw SQL equivalent of src/seed.ts
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING)
-- ============================================================

-- 1. Asset Types
INSERT INTO "asset_types" ("id", "name", "symbol")
VALUES
  (1, 'Gold Coins', 'GC'),
  (2, 'Diamonds', 'DIA'),
  (3, 'Loyalty Points', 'LP')
ON CONFLICT ("name") DO UPDATE SET "id" = EXCLUDED."id";

-- 2. System Wallets (type: 'system', userId: NULL, balance: 0)
INSERT INTO "wallets" ("id", "userId", "name", "type", "assetTypeId", "balance")
VALUES
  (101, NULL, 'System Gold Coins',     'system', 1, 0),
  (102, NULL, 'System Diamonds',       'system', 2, 0),
  (103, NULL, 'System Loyalty Points', 'system', 3, 0)
ON CONFLICT DO NOTHING;

-- 3. User Wallets — Alice (user-1)
INSERT INTO "wallets" ("id", "userId", "name", "type", "assetTypeId", "balance")
VALUES
  (211, 'user-1', 'Alice Gold Coins',     'user', 1, 1000),
  (212, 'user-1', 'Alice Diamonds',       'user', 2, 500),
  (213, 'user-1', 'Alice Loyalty Points', 'user', 3, 2000)
ON CONFLICT DO NOTHING;

-- 4. User Wallets — Bob (user-2)
INSERT INTO "wallets" ("id", "userId", "name", "type", "assetTypeId", "balance")
VALUES
  (221, 'user-2', 'Bob Gold Coins',     'user', 1, 500),
  (222, 'user-2', 'Bob Diamonds',       'user', 2, 100),
  (223, 'user-2', 'Bob Loyalty Points', 'user', 3, 800)
ON CONFLICT DO NOTHING;
