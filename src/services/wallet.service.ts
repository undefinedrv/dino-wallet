import { EntityManager } from "typeorm";
import { AppDataSource } from "../config/database";
import { Wallet, WalletType } from "../entities/Wallet";
import {
    Transaction,
    TransactionType,
    TransactionStatus,
} from "../entities/Transaction";
import { LedgerEntry, EntryType } from "../entities/LedgerEntry";

interface TransactionInput {
    userId: string;
    assetTypeId: string;
    amount: number;
    idempotencyKey: string;
    description?: string;
}

class AppError extends Error {
    code: string;
    constructor(message: string, code: string) {
        super(message);
        this.code = code;
        this.name = "AppError";
    }
}

export class WalletService {
    /**
     * TOPUP: External payment → User wallet ↑, System wallet ↑
     * Both increase because new credits are entering the system.
     */
    async topUp(input: TransactionInput): Promise<Transaction> {
        return this.executeTransaction(input, TransactionType.TOPUP);
    }

    /**
     * BONUS: System gives free credits → User wallet ↑, System wallet ↓
     */
    async bonus(input: TransactionInput): Promise<Transaction> {
        return this.executeTransaction(input, TransactionType.BONUS);
    }

    /**
     * SPEND: User buys something in-app → User wallet ↓, System wallet ↑
     */
    async spend(input: TransactionInput): Promise<Transaction> {
        return this.executeTransaction(input, TransactionType.SPEND);
    }

    /**
     * Get all wallet balances for a user, joined with asset type info.
     */
    async getBalance(userId: string): Promise<
        Array<{
            walletId: string;
            name: string;
            assetType: string;
            symbol: string;
            balance: string;
        }>
    > {
        const wallets = await AppDataSource.getRepository(Wallet).find({
            where: { userId },
            relations: ["assetType"],
        });

        return wallets.map((w) => ({
            walletId: w.id,
            name: w.name,
            assetType: w.assetType.name,
            symbol: w.assetType.symbol,
            balance: w.balance,
        }));
    }

    /**
     * Get paginated transactions for a user (where they are debit or credit party).
     */
    async getTransactions(
        userId: string,
        page: number,
        limit: number
    ): Promise<{
        data: Transaction[];
        total: number;
        page: number;
        limit: number;
    }> {
        // First find the user's wallet IDs
        const wallets = await AppDataSource.getRepository(Wallet).find({
            where: { userId },
            select: ["id"],
        });

        if (wallets.length === 0) {
            return { data: [], total: 0, page, limit };
        }

        const walletIds = wallets.map((w) => w.id);

        const [data, total] = await AppDataSource.getRepository(Transaction)
            .createQueryBuilder("tx")
            .leftJoinAndSelect("tx.ledgerEntries", "ledger")
            .where(
                "tx.debitWalletId IN (:...walletIds) OR tx.creditWalletId IN (:...walletIds)",
                { walletIds }
            )
            .orderBy("tx.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        return { data, total, page, limit };
    }

    /**
     * Core transaction executor — handles TOPUP, BONUS, SPEND with:
     *   1. Idempotency check
     *   2. Wallet lookup
     *   3. Deadlock-safe locking (sorted wallet IDs)
     *   4. Balance validation
     *   5. Balance updates
     *   6. Transaction record creation
     *   7. Double-entry ledger entries
     */
    private async executeTransaction(
        input: TransactionInput,
        type: TransactionType
    ): Promise<Transaction> {
        const { userId, assetTypeId, amount, idempotencyKey, description } =
            input;

        return AppDataSource.transaction(async (manager: EntityManager) => {
            // ── Step 1: Idempotency check ──
            const existingTx = await manager.findOne(Transaction, {
                where: { idempotencyKey },
                relations: ["ledgerEntries"],
            });
            if (existingTx) {
                return existingTx;
            }

            // ── Step 2: Find wallets ──
            const userWallet = await manager.findOne(Wallet, {
                where: { userId, assetTypeId },
            });
            if (!userWallet) {
                throw new AppError(
                    `User wallet not found for userId=${userId}, assetTypeId=${assetTypeId}`,
                    "NOT_FOUND"
                );
            }

            const systemWallet = await manager.findOne(Wallet, {
                where: { type: WalletType.SYSTEM, assetTypeId },
            });
            if (!systemWallet) {
                throw new AppError(
                    `System wallet not found for assetTypeId=${assetTypeId}`,
                    "NOT_FOUND"
                );
            }

            // ── Step 3: Lock wallets (DEADLOCK PREVENTION) ──
            // Sort wallet IDs alphabetically and lock in that order
            const sortedIds = [userWallet.id, systemWallet.id].sort();

            const lockedWallets: Record<string, Wallet> = {};
            for (const id of sortedIds) {
                const locked = await manager
                    .createQueryBuilder(Wallet, "wallet")
                    .setLock("pessimistic_write")
                    .where("wallet.id = :id", { id })
                    .getOne();
                if (!locked) {
                    throw new AppError(
                        `Wallet ${id} not found during lock`,
                        "NOT_FOUND"
                    );
                }
                lockedWallets[id] = locked;
            }

            // Re-assign from locked versions (with up-to-date balances)
            const lockedUserWallet = lockedWallets[userWallet.id];
            const lockedSystemWallet = lockedWallets[systemWallet.id];

            // ── Step 4: Balance check ──
            let debitWallet: Wallet;
            let creditWallet: Wallet;

            switch (type) {
                case TransactionType.TOPUP:
                    // System wallet is debit (balance increases), User wallet is credit (balance increases)
                    debitWallet = lockedSystemWallet;
                    creditWallet = lockedUserWallet;
                    // No balance check — new money is entering the system
                    break;

                case TransactionType.BONUS:
                    // System wallet is debit (balance decreases), User wallet is credit (balance increases)
                    debitWallet = lockedSystemWallet;
                    creditWallet = lockedUserWallet;
                    if (BigInt(lockedSystemWallet.balance) < BigInt(amount)) {
                        throw new AppError(
                            "System wallet has insufficient balance for bonus",
                            "INSUFFICIENT_SYSTEM_BALANCE"
                        );
                    }
                    break;

                case TransactionType.SPEND:
                    // User wallet is debit (balance decreases), System wallet is credit (balance increases)
                    debitWallet = lockedUserWallet;
                    creditWallet = lockedSystemWallet;
                    if (BigInt(lockedUserWallet.balance) < BigInt(amount)) {
                        throw new AppError(
                            "Insufficient balance",
                            "INSUFFICIENT_BALANCE"
                        );
                    }
                    break;

                default:
                    throw new AppError(
                        `Unknown transaction type: ${type}`,
                        "VALIDATION"
                    );
            }

            // ── Step 5: Update balances ──
            switch (type) {
                case TransactionType.TOPUP:
                    // Both go UP — new credits entering the system
                    lockedSystemWallet.balance = (
                        BigInt(lockedSystemWallet.balance) + BigInt(amount)
                    ).toString();
                    lockedUserWallet.balance = (
                        BigInt(lockedUserWallet.balance) + BigInt(amount)
                    ).toString();
                    break;

                case TransactionType.BONUS:
                    // System goes DOWN, User goes UP
                    lockedSystemWallet.balance = (
                        BigInt(lockedSystemWallet.balance) - BigInt(amount)
                    ).toString();
                    lockedUserWallet.balance = (
                        BigInt(lockedUserWallet.balance) + BigInt(amount)
                    ).toString();
                    break;

                case TransactionType.SPEND:
                    // User goes DOWN, System goes UP
                    lockedUserWallet.balance = (
                        BigInt(lockedUserWallet.balance) - BigInt(amount)
                    ).toString();
                    lockedSystemWallet.balance = (
                        BigInt(lockedSystemWallet.balance) + BigInt(amount)
                    ).toString();
                    break;
            }

            await manager.save(Wallet, lockedUserWallet);
            await manager.save(Wallet, lockedSystemWallet);

            // ── Step 6: Create transaction record ──
            const transaction = manager.create(Transaction, {
                idempotencyKey,
                type,
                status: TransactionStatus.SUCCESS,
                amount: amount.toString(),
                debitWalletId: debitWallet.id,
                creditWalletId: creditWallet.id,
                description: description || null,
            });
            const savedTx = await manager.save(Transaction, transaction);

            // ── Step 7: Create 2 ledger entries ──
            const debitEntry = manager.create(LedgerEntry, {
                transactionId: savedTx.id,
                walletId: debitWallet.id,
                entryType: EntryType.DEBIT,
                amount: amount.toString(),
                balanceAfter:
                    debitWallet.id === lockedUserWallet.id
                        ? lockedUserWallet.balance
                        : lockedSystemWallet.balance,
            });

            const creditEntry = manager.create(LedgerEntry, {
                transactionId: savedTx.id,
                walletId: creditWallet.id,
                entryType: EntryType.CREDIT,
                amount: amount.toString(),
                balanceAfter:
                    creditWallet.id === lockedUserWallet.id
                        ? lockedUserWallet.balance
                        : lockedSystemWallet.balance,
            });

            const savedEntries = await manager.save(LedgerEntry, [
                debitEntry,
                creditEntry,
            ]);

            // ── Step 8: Return the full transaction with ledger entries ──
            savedTx.ledgerEntries = savedEntries;
            return savedTx;
        });
    }
}
