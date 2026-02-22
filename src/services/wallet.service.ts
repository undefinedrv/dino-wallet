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
                relations: ["assetType"],
            });
            if (!userWallet) {
                throw new AppError(
                    `Wallet not found for userId=${userId}, assetTypeId=${assetTypeId}`,
                    "NOT_FOUND"
                );
            }

            // System wallet only needed for BONUS and SPEND
            let systemWallet: Wallet | null = null;
            if (
                type === TransactionType.BONUS ||
                type === TransactionType.SPEND
            ) {
                systemWallet = await manager.findOne(Wallet, {
                    where: { type: WalletType.SYSTEM, assetTypeId },
                });
                if (!systemWallet) {
                    throw new AppError(
                        `System wallet not found for assetTypeId=${assetTypeId}`,
                        "NOT_FOUND"
                    );
                }
            }

            // ── Step 3: Lock wallets (sorted order) ──
            const walletsToLock = [userWallet];
            if (systemWallet) walletsToLock.push(systemWallet);

            const sortedIds = walletsToLock.map((w) => w.id).sort();
            const lockedWallets: Record<string, Wallet> = {};

            for (const id of sortedIds) {
                const locked = await manager
                    .createQueryBuilder(Wallet, "wallet")
                    .setLock("pessimistic_write")
                    .where("wallet.id = :id", { id })
                    .getOne();
                if (!locked) throw new AppError(`Lock failed`, "NOT_FOUND");
                lockedWallets[id] = locked;
            }

            const lockedUserWallet = lockedWallets[userWallet.id];
            const lockedSystemWallet = systemWallet
                ? lockedWallets[systemWallet.id]
                : null;

            // ── Step 4 & 5: Logic depending on type ──
            let debitWalletId: string | null = null;
            let creditWalletId: string | null = null;

            switch (type) {
                case TransactionType.TOPUP:
                    // Only User (Credit) -- System not involved
                    lockedUserWallet.balance = (
                        BigInt(lockedUserWallet.balance) + BigInt(amount)
                    ).toString();
                    creditWalletId = lockedUserWallet.id;
                    break;

                case TransactionType.BONUS:
                    // BONUS: System (Debit) -> User (Credit)
                    // System CAN go negative for bonus
                    if (lockedSystemWallet) {
                        lockedSystemWallet.balance = (
                            BigInt(lockedSystemWallet.balance) - BigInt(amount)
                        ).toString();
                        debitWalletId = lockedSystemWallet.id;
                    }
                    lockedUserWallet.balance = (
                        BigInt(lockedUserWallet.balance) + BigInt(amount)
                    ).toString();
                    creditWalletId = lockedUserWallet.id;
                    break;

                case TransactionType.SPEND:
                    // SPEND: User (Debit) -> System (Credit)
                    // User CANNOT go negative
                    if (BigInt(lockedUserWallet.balance) < BigInt(amount)) {
                        throw new AppError(
                            "Insufficient balance",
                            "INSUFFICIENT_BALANCE"
                        );
                    }
                    lockedUserWallet.balance = (
                        BigInt(lockedUserWallet.balance) - BigInt(amount)
                    ).toString();
                    debitWalletId = lockedUserWallet.id;

                    if (lockedSystemWallet) {
                        lockedSystemWallet.balance = (
                            BigInt(lockedSystemWallet.balance) + BigInt(amount)
                        ).toString();
                        creditWalletId = lockedSystemWallet.id;
                    }
                    break;
            }

            // Save updated balances
            await manager.save(Wallet, lockedUserWallet);
            if (lockedSystemWallet)
                await manager.save(Wallet, lockedSystemWallet);

            // ── Step 6: Create Transaction record ──
            const transaction = manager.create(Transaction, {
                idempotencyKey,
                type,
                status: TransactionStatus.SUCCESS,
                amount: amount.toString(),
                debitWalletId,
                creditWalletId,
                description,
            });
            const savedTx = await manager.save(Transaction, transaction);

            // ── Step 7: Create Ledger entries ──
            const entries: LedgerEntry[] = [];

            // User Entry
            entries.push(
                manager.create(LedgerEntry, {
                    transactionId: savedTx.id,
                    walletId: lockedUserWallet.id,
                    entryType:
                        type === TransactionType.SPEND
                            ? EntryType.DEBIT
                            : EntryType.CREDIT,
                    amount: amount.toString(),
                    balanceAfter: lockedUserWallet.balance,
                })
            );

            // System Entry (only for BONUS and SPEND)
            if (lockedSystemWallet) {
                entries.push(
                    manager.create(LedgerEntry, {
                        transactionId: savedTx.id,
                        walletId: lockedSystemWallet.id,
                        entryType:
                            type === TransactionType.BONUS
                                ? EntryType.DEBIT
                                : EntryType.CREDIT,
                        amount: amount.toString(),
                        balanceAfter: lockedSystemWallet.balance,
                    })
                );
            }

            savedTx.ledgerEntries = await manager.save(LedgerEntry, entries);
            return savedTx;
        });
    }
}
