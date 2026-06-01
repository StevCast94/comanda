import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET no está configurado. Define una variable de entorno aleatoria (≥32 bytes) antes de arrancar."
  );
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  restaurantId: string | null;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      restaurantId?: string | null;
    }
  }
}

/** Extract and verify JWT from Authorization header */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token requerido" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

/** Factory: restrict route to specific roles */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    // SUPERADMIN always passes
    if (req.user.role === "SUPERADMIN") {
      next();
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Sin permisos para esta acción" });
      return;
    }
    next();
  };
}

/** Generate JWT */
export function signToken(payload: JwtPayload, expiresIn = "12h"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

export { JWT_SECRET };
