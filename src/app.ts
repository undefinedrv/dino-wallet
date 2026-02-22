import "reflect-metadata";
import express from "express";
import * as dotenv from "dotenv";
import { AppDataSource } from "./config/database";
import walletRoutes from "./routes/wallet.routes";
import { errorHandler } from "./middlewares/errorHandler";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
});

// API routes
app.use("/api/wallets", walletRoutes);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
AppDataSource.initialize()
    .then(() => {
        console.log("✅ Database connected successfully");
        app.listen(PORT, () => {
            console.log(`🚀 Wallet service running on port ${PORT}`);
        });
    })
    .catch((error: any) => {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    });

export default app;
