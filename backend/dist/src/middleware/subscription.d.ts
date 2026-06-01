import { Request, Response, NextFunction } from "express";
/**
 * Subscription validation middleware.
 * Checks that the restaurant's subscription is active and within limits.
 * Runs AFTER tenant isolation (req.restaurantId is set).
 */
export declare function checkSubscription(req: Request, res: Response, next: NextFunction): void;
/** Helper: check if a specific limit is exceeded */
export declare function checkLimit(restaurantId: string, limitType: "users" | "products" | "combos"): Promise<{
    allowed: boolean;
    current: number;
    max: number;
}>;
//# sourceMappingURL=subscription.d.ts.map