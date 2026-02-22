import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { Base } from "./Base";
import { Transaction } from "./Transaction";
import { Wallet } from "./Wallet";

export enum EntryType {
    DEBIT = "DEBIT",
    CREDIT = "CREDIT",
}

@Entity("ledger_entries")
export class LedgerEntry extends Base {
    @Column({ type: "bigint" })
    transactionId: string;

    @ManyToOne(() => Transaction, (transaction) => transaction.ledgerEntries, {
        eager: false,
    })
    @JoinColumn({ name: "transactionId" })
    transaction: Transaction;

    @Column({ type: "bigint" })
    walletId: string;

    @ManyToOne(() => Wallet, { eager: false })
    @JoinColumn({ name: "walletId" })
    wallet: Wallet;

    @Column({
        type: "enum",
        enum: EntryType,
    })
    entryType: EntryType;

    @Column({ type: "bigint" })
    amount: string;

    @Column({ type: "bigint" })
    balanceAfter: string;
}
