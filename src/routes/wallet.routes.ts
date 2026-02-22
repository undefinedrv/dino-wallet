import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";

const router = Router();
const controller = new WalletController();

// Transaction endpoints
router.post("/topup", (req, res, next) => controller.topUp(req, res, next));
router.post("/bonus", (req, res, next) => controller.bonus(req, res, next));
router.post("/spend", (req, res, next) => controller.spend(req, res, next));

// Query endpoints
router.get("/:userId/balance", (req, res, next) =>
    controller.getBalance(req, res, next)
);
router.get("/:userId/transactions", (req, res, next) =>
    controller.getTransactions(req, res, next)
);

export default router;
