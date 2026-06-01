import { Request, Response, NextFunction } from "express";
/**
 * Multi-tenant isolation middleware.
 * Runs AFTER auth.ts — extracts restaurantId from JWT and injects into req.
 *
 * - SUPERADMIN (restaurantId = null): can access all restaurants.
 *   If they pass ?restaurantId=X in query, scopes to that restaurant.
 * - All other roles: locked to their JWT restaurantId.
 *   Any attempt to access another restaurant → 403.
 */
export declare function tenantIsolation(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=tenant.d.ts.map