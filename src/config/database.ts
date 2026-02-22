import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { AssetType } from "../entities/AssetType";
import { Wallet } from "../entities/Wallet";
import { Transaction } from "../entities/Transaction";
import { LedgerEntry } from "../entities/LedgerEntry";

dotenv.config();

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [AssetType, Wallet, Transaction, LedgerEntry],
    migrations: ["src/migrations/*.ts"],
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
});
