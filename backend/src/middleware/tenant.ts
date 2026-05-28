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
export function tenantIsolation(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const { role, restaurantId: jwtRestaurantId } = req.user;

  if (role === "SUPERADMIN") {
    // SUPERADMIN can optionally scope to a specific restaurant via query param
    const queryRestaurantId = req.query.restaurantId as string | undefined;
    req.restaurantId = queryRestaurantId || null;
    next();
    return;
  }

  // All non-SUPERADMIN users MUST have a restaurantId
  if (!jwtRestaurantId) {
    res.status(403).json({ error: "Usuario sin restaurante asignado" });
    return;
  }

  // Check if request body or params try to access a different restaurant
  const bodyRestaurantId = req.body?.restaurantId as string | undefined;
  const paramRestaurantId = req.params?.restaurantId as string | undefined;

  if (bodyRestaurantId && bodyRestaurantId !== jwtRestaurantId) {
    res.status(403).json({ error: "No puedes acceder a datos de otro restaurante" });
    return;
  }

  if (paramRestaurantId && paramRestaurantId !== jwtRestaurantId) {
    res.status(403).json({ error: "No puedes acceder a datos de otro restaurante" });
    return;
  }

  req.restaurantId = jwtRestaurantId;
  next();
}
