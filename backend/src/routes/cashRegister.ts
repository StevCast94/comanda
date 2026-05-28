import { Router as CRRouter, Request as CRReq, Response as CRRes } from "express";
import { prisma as crPrisma } from "../index";
import { authenticate as crAuth, authorize as crAuthz } from "../middleware/auth";
import { tenantIsolation as crTenant } from "../middleware/tenant";
import { checkSubscription as crSub } from "../middleware/subscription";

const crRouter = CRRouter();
crRouter.use(crAuth, crTenant, crSub);

// POST /api/cash-register/open
crRouter.post("/open", crAuthz("CASHIER", "ADMIN"), async (req: CRReq, res: CRRes) => {
  try {
    const existing = await crPrisma.cashRegister.findFirst({
      where: { restaurantId: req.restaurantId!, status: "OPEN" },
    });
    if (existing) {
      res.status(400).json({ error: "Ya hay una caja abierta" });
      return;
    }
    const register = await crPrisma.cashRegister.create({
      data: {
        restaurantId: req.restaurantId!,
        cashierId: req.user!.userId,
        openingBalance: req.body.openingBalance || 0,
      },
    });
    res.status(201).json({ register });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error abriendo caja" });
  }
});

// POST /api/cash-register/close
crRouter.post("/close", crAuthz("CASHIER", "ADMIN"), async (req: CRReq, res: CRRes) => {
  try {
    const register = await crPrisma.cashRegister.findFirst({
      where: { restaurantId: req.restaurantId!, status: "OPEN" },
    });
    if (!register) {
      res.status(400).json({ error: "No hay caja abierta" });
      return;
    }
    const expectedBalance = register.openingBalance + register.totalSales - register.totalExpenses;
    const closed = await crPrisma.cashRegister.update({
      where: { id: register.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingBalance: req.body.closingBalance || 0,
        expectedBalance,
        notes: req.body.notes,
      },
    });
    res.json({ register: closed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cerrando caja" });
  }
});

// GET /api/cash-register/current
crRouter.get("/current", crAuthz("CASHIER", "ADMIN"), async (req: CRReq, res: CRRes) => {
  try {
    const register = await crPrisma.cashRegister.findFirst({
      where: { restaurantId: req.restaurantId!, status: "OPEN" },
      include: { cashier: { select: { name: true } } },
    });
    res.json({ register });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

export { crRouter as default };



