import { Request, Response, NextFunction } from "express";
import { WalletService } from "../services/wallet.service";

const walletService = new WalletService();

export class WalletController {
    async topUp(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { userId, assetTypeId, amount, idempotencyKey, description } =
                req.body;

            // Validation
            if (!userId || !assetTypeId || !amount || !idempotencyKey) {
                res.status(400).json({
                    error: "Missing required fields: userId, assetTypeId, amount, idempotencyKey",
                    code: "VALIDATION",
                });
                return;
            }

            if (assetTypeId.toString() === "3") {
                res.status(400).json({
                    error: "Users cannot top up Loyalty Points",
                    code: "VALIDATION",
                });
                return;
            }

            if (!Number.isInteger(amount) || amount <= 0) {
                res.status(400).json({
                    error: "amount must be a positive integer",
                    code: "VALIDATION",
                });
                return;
            }

            const result = await walletService.topUp({
                userId,
                assetTypeId,
                amount,
                idempotencyKey,
                description,
            });

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async bonus(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { userId, assetTypeId, amount, idempotencyKey, description } =
                req.body;
            const { userType } = req.query;

            // 1. Check userType query param
            if (userType !== "system") {
                res.status(403).json({
                    error: "Only system can grant bonus",
                    code: "UNAUTHORIZED",
                });
                return;
            }

            // 2. Missing fields check
            if (!userId || !assetTypeId || !amount || !idempotencyKey) {
                res.status(400).json({
                    error: "Missing required fields: userId, assetTypeId, amount, idempotencyKey",
                    code: "VALIDATION",
                });
                return;
            }

            // 3. AssetType restriction (only 3 is allowed for Bonus)
            // assetTypeId is a string in the body
            if (assetTypeId.toString() !== "3") {
                res.status(400).json({
                    error: "Bonus can only be granted for assetTypeId 3 (Loyalty Points)",
                    code: "VALIDATION",
                });
                return;
            }

            if (!Number.isInteger(amount) || amount <= 0) {
                res.status(400).json({
                    error: "amount must be a positive integer",
                    code: "VALIDATION",
                });
                return;
            }

            const result = await walletService.bonus({
                userId,
                assetTypeId,
                amount,
                idempotencyKey,
                description,
            });

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async spend(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { userId, assetTypeId, amount, idempotencyKey, description } =
                req.body;

            // Validation
            if (!userId || !assetTypeId || !amount || !idempotencyKey) {
                res.status(400).json({
                    error: "Missing required fields: userId, assetTypeId, amount, idempotencyKey",
                    code: "VALIDATION",
                });
                return;
            }

            if (!Number.isInteger(amount) || amount <= 0) {
                res.status(400).json({
                    error: "amount must be a positive integer",
                    code: "VALIDATION",
                });
                return;
            }

            const result = await walletService.spend({
                userId,
                assetTypeId,
                amount,
                idempotencyKey,
                description,
            });

            res.status(200).json(result);
        } catch (error: any) {
            if (error.code === "INSUFFICIENT_BALANCE") {
                res.status(422).json({
                    error: "Insufficient balance",
                    code: "INSUFFICIENT_BALANCE",
                });
                return;
            }
            next(error);
        }
    }

    async getBalance(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.params.userId as string;
            const balances = await walletService.getBalance(userId);
            res.status(200).json(balances);
        } catch (error) {
            next(error);
        }
    }

    async getTransactions(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.params.userId as string;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await walletService.getTransactions(
                userId,
                page,
                limit
            );
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }
}
