import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Base } from "./Base";
import { Wallet } from "./Wallet";
import { LedgerEntry } from "./LedgerEntry";

export enum TransactionType {
    TOPUP = "TOPUP",
    BONUS = "BONUS",
    SPEND = "SPEND",
}

export enum TransactionStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
}

@Entity("transactions")
export class Transaction extends Base {
    @Column({ type: "varchar", unique: true })
    idempotencyKey: string;

    @Column({
        type: "enum",
        enum: TransactionType,
    })
    type: TransactionType;

    @Column({
        type: "enum",
        enum: TransactionStatus,
        default: TransactionStatus.PENDING,
    })
    status: TransactionStatus;

    @Column({ type: "bigint" })
    amount: string;

    @Column({ type: "bigint" })
    debitWalletId: string;

    @ManyToOne(() => Wallet, { eager: false })
    @JoinColumn({ name: "debitWalletId" })
    debitWallet: Wallet;

    @Column({ type: "bigint" })
    creditWalletId: string;

    @ManyToOne(() => Wallet, { eager: false })
    @JoinColumn({ name: "creditWalletId" })
    creditWallet: Wallet;

    @Column({ type: "varchar", nullable: true })
    description: string | null;

    @OneToMany(() => LedgerEntry, (entry) => entry.transaction, { eager: true })
    ledgerEntries: LedgerEntry[];
}
