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

    @Column({ type: "bigint", nullable: true })
    debitWalletId: string | null;

    @ManyToOne(() => Wallet, { eager: false, nullable: true })
    @JoinColumn({ name: "debitWalletId" })
    debitWallet: Wallet | null;

    @Column({ type: "bigint", nullable: true })
    creditWalletId: string | null;

    @ManyToOne(() => Wallet, { eager: false, nullable: true })
    @JoinColumn({ name: "creditWalletId" })
    creditWallet: Wallet | null;

    @Column({ type: "varchar", nullable: true })
    description: string | null;

    @OneToMany(() => LedgerEntry, (entry) => entry.transaction, { eager: true })
    ledgerEntries: LedgerEntry[];
}
