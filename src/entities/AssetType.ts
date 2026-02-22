import { Entity, Column, OneToMany } from "typeorm";
import { Base } from "./Base";
import { Wallet } from "./Wallet";

@Entity("asset_types")
export class AssetType extends Base {
    @Column({ type: "varchar", unique: true })
    name: string;

    @Column({ type: "varchar" })
    symbol: string;

    @Column({ type: "boolean", default: true })
    isActive: boolean;

    @OneToMany(() => Wallet, (wallet) => wallet.assetType)
    wallets: Wallet[];
}
