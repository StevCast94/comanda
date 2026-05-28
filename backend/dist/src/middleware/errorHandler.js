"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
class AppError extends Error {
    statusCode;
    code;
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
function errorHandler(err, _req, res, _next) {
    console.error(`[ERROR] ${err.name}: ${err.message}`);
    // Custom app errors
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
        });
        return;
    }
    // Zod validation errors
    if (err instanceof zod_1.ZodError) {
        const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
        res.status(400).json({
            error: "Datos inválidos",
            details: messages,
        });
        return;
    }
    // Prisma known errors
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case "P2002": {
                const fields = err.meta?.target || [];
                res.status(409).json({
                    error: `Ya existe un registro con ese ${fields.join(", ")}`,
                    code: "DUPLICATE",
                });
                return;
            }
            case "P2025":
                res.status(404).json({ error: "Registro no encontrado" });
                return;
            case "P2003":
                res.status(400).json({ error: "Referencia inválida. El registro relacionado no existe." });
                return;
            default:
                res.status(400).json({ error: `Error de base de datos: ${err.code}` });
                return;
        }
    }
    // Unknown errors
    res.status(500).json({ error: "Error interno del servidor" });
}
//# sourceMappingURL=errorHandler.js.map