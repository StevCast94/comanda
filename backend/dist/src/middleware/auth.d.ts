import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
declare const JWT_SECRET: string;
export interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
    restaurantId: string | null;
    tokenVersion: number;
}
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
            restaurantId?: string | null;
        }
    }
}
/** Extract and verify JWT from Authorization header */
export declare function authenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
/** Factory: restrict route to specific roles */
export declare function authorize(...allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
/** Generate JWT */
export declare function signToken(payload: JwtPayload, expiresIn?: string): string;
export { JWT_SECRET };
//# sourceMappingURL=auth.d.ts.map