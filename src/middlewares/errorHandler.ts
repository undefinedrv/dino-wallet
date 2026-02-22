import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
    code?: string;
}

const ERROR_STATUS_MAP: Record<string, number> = {
    INSUFFICIENT_BALANCE: 422,
    INSUFFICIENT_SYSTEM_BALANCE: 422,
    NOT_FOUND: 404,
    VALIDATION: 400,
};

export function errorHandler(
    err: AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    const code = err.code || "INTERNAL_ERROR";
    const status = ERROR_STATUS_MAP[code] || 500;
    const message = status === 500 ? "Internal server error" : err.message;

    if (status === 500) {
        console.error("Unhandled error:", err);
    }

    res.status(status).json({
        error: message,
        code,
    });
}
