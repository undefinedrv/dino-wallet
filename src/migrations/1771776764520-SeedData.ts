import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedData1771776764520 implements MigrationInterface {
    name = "SeedData1771776764520";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Asset Types
        await queryRunner.query(`
            INSERT INTO "asset_types" ("id", "name", "symbol")
            VALUES
                (1, 'Gold Coins', 'GC'),
                (2, 'Diamonds Coins', 'DC'),
                (3, 'Loyalty Points', 'LP')
            ON CONFLICT ("name") DO NOTHING;
        `);

        // 2. System Wallets (IDs 1, 2, 3)
        await queryRunner.query(`
            INSERT INTO "wallets" ("id", "userId", "name", "type", "assetTypeId", "balance")
            VALUES
                (1, NULL, 'System Gold Coins',     'system', 1, 0),
                (2, NULL, 'System Diamonds',       'system', 2, 0),
                (3, NULL, 'System Loyalty Points', 'system', 3, 0)
            ON CONFLICT DO NOTHING;
        `);

        // 3. User Wallets
        // Raghav (userid = 1)
        await queryRunner.query(`
            INSERT INTO "wallets" ("id", "userId", "name", "type", "assetTypeId", "balance")
            VALUES
                (4, '1', 'Raghav Gold Coins',     'user', 1, 1000),
                (5, '1', 'Raghav Diamonds Coins',       'user', 2, 1000),
                (6, '1', 'Raghav Loyalty Points', 'user', 3, 0)
            ON CONFLICT DO NOTHING;
        `);

        // Bhati (userid = 2)
        await queryRunner.query(`
            INSERT INTO "wallets" ("id", "userId", "name", "type", "assetTypeId", "balance")
            VALUES
                (7, '2', 'Bhati Gold Coins',     'user', 1, 500),
                (8, '2', 'Bhati Diamonds Coins',       'user', 2, 500),
                (9, '2', 'Bhati Loyalty Points', 'user', 3, 0)
            ON CONFLICT DO NOTHING;
        `);

        // ── Step 4: Sync sequences ──
        // Since we manually inserted IDs, we must update the identity sequences
        // so the next automatic ID doesn't collide with our manual ones.
        await queryRunner.query(
            `SELECT setval(pg_get_serial_sequence('asset_types', 'id'), coalesce(max(id), 0) + 1, false) FROM "asset_types";`
        );
        await queryRunner.query(
            `SELECT setval(pg_get_serial_sequence('wallets', 'id'), coalesce(max(id), 0) + 1, false) FROM "wallets";`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the seeded data in reverse order
        await queryRunner.query(
            `DELETE FROM "wallets" WHERE "id" IN (101, 102, 103, 211, 212, 213, 221, 222, 223);`
        );
        await queryRunner.query(
            `DELETE FROM "asset_types" WHERE "id" IN (1, 2, 3);`
        );
    }
}
