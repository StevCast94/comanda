import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
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
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    res.status(400).json({
      error: "Datos inválidos",
      details: messages,
    });
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const fields = (err.meta?.target as string[]) || [];
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
