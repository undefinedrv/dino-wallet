import { MigrationInterface, QueryRunner } from "typeorm";

export class TableSchema1771776714610 implements MigrationInterface {
    name = "TableSchema1771776714610";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."wallets_type_enum" AS ENUM('user', 'system')`
        );
        await queryRunner.query(
            `CREATE TABLE "wallets" ("id" BIGSERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" character varying, "name" character varying NOT NULL, "type" "public"."wallets_type_enum" NOT NULL DEFAULT 'user', "assetTypeId" bigint NOT NULL, "balance" bigint NOT NULL DEFAULT '0', CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_wallets_userId_assetTypeId" ON "wallets" ("userId", "assetTypeId") WHERE "userId" IS NOT NULL`
        );
        await queryRunner.query(
            `CREATE TABLE "asset_types" ("id" BIGSERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "symbol" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_637155978e16c108cd4fc721b78" UNIQUE ("name"), CONSTRAINT "PK_2cf0314bcc4351b7f2827d57edb" PRIMARY KEY ("id"))`
        );
        await queryRunner.query(
            `CREATE TYPE "public"."ledger_entries_entrytype_enum" AS ENUM('DEBIT', 'CREDIT')`
        );
        await queryRunner.query(
            `CREATE TABLE "ledger_entries" ("id" BIGSERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "transactionId" bigint NOT NULL, "walletId" bigint NOT NULL, "entryType" "public"."ledger_entries_entrytype_enum" NOT NULL, "amount" bigint NOT NULL, "balanceAfter" bigint NOT NULL, CONSTRAINT "PK_6efcb84411d3f08b08450ae75d5" PRIMARY KEY ("id"))`
        );
        await queryRunner.query(
            `CREATE TYPE "public"."transactions_type_enum" AS ENUM('TOPUP', 'BONUS', 'SPEND')`
        );
        await queryRunner.query(
            `CREATE TYPE "public"."transactions_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED')`
        );
        await queryRunner.query(
            `CREATE TABLE "transactions" ("id" BIGSERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "idempotencyKey" character varying NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'PENDING', "amount" bigint NOT NULL, "debitWalletId" bigint, "creditWalletId" bigint, "description" character varying, CONSTRAINT "UQ_86238dd0ae2d79be941104a5842" UNIQUE ("idempotencyKey"), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`
        );
        await queryRunner.query(
            `ALTER TABLE "wallets" ADD CONSTRAINT "FK_b19197e46d82d264902ca82cd8e" FOREIGN KEY ("assetTypeId") REFERENCES "asset_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        );
        await queryRunner.query(
            `ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_ce01dd5f8bde23f503bf01ffacc" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        );
        await queryRunner.query(
            `ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_df977c08d98fab6543724d74859" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" ADD CONSTRAINT "FK_d38c45dedac5914be8fa8c7fc0f" FOREIGN KEY ("debitWalletId") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" ADD CONSTRAINT "FK_b9ada4f468e2fe179f1a1aa42f7" FOREIGN KEY ("creditWalletId") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "transactions" DROP CONSTRAINT "FK_b9ada4f468e2fe179f1a1aa42f7"`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" DROP CONSTRAINT "FK_d38c45dedac5914be8fa8c7fc0f"`
        );
        await queryRunner.query(
            `ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_df977c08d98fab6543724d74859"`
        );
        await queryRunner.query(
            `ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_ce01dd5f8bde23f503bf01ffacc"`
        );
        await queryRunner.query(
            `ALTER TABLE "wallets" DROP CONSTRAINT "FK_b19197e46d82d264902ca82cd8e"`
        );
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(
            `DROP TYPE "public"."transactions_status_enum"`
        );
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
        await queryRunner.query(`DROP TABLE "ledger_entries"`);
        await queryRunner.query(
            `DROP TYPE "public"."ledger_entries_entrytype_enum"`
        );
        await queryRunner.query(`DROP TABLE "asset_types"`);
        await queryRunner.query(
            `DROP INDEX "public"."IDX_wallets_userId_assetTypeId"`
        );
        await queryRunner.query(`DROP TABLE "wallets"`);
        await queryRunner.query(`DROP TYPE "public"."wallets_type_enum"`);
    }
}
