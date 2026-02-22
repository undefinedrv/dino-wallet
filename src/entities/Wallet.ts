import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { Base } from "./Base";
import { AssetType } from "./AssetType";

export enum WalletType {
    USER = "user",
    SYSTEM = "system",
}

@Entity("wallets")
@Index("IDX_wallets_userId_assetTypeId", ["userId", "assetTypeId"], {
    unique: true,
    where: '"userId" IS NOT NULL',
})
export class Wallet extends Base {
    @Column({ type: "varchar", nullable: true })
    userId: string | null;

    @Column({ type: "varchar" })
    name: string;

    @Column({
        type: "enum",
        enum: WalletType,
        default: WalletType.USER,
    })
    type: WalletType;

    @Column({ type: "bigint" })
    assetTypeId: string;

    @ManyToOne(() => AssetType, (assetType) => assetType.wallets, {
        eager: false,
    })
    @JoinColumn({ name: "assetTypeId" })
    assetType: AssetType;

    @Column({ type: "bigint", default: 0 })
    balance: string; // bigint is returned as string by pg driver
}
