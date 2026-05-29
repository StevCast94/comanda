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

    // Recalcular expectedBalance basado en órdenes reales del día
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const ordersToday = await crPrisma.order.findMany({
      where: {
        restaurantId: req.restaurantId!,
        paidAt: { gte: today, lt: tomorrow },
        status: { not: "CANCELLED" },
      },
      select: { total: true, paymentMethod: true },
    });

    // Calcular por método de pago desde las órdenes REALES
    let realCash = 0, realCard = 0, realTransfer = 0;
    for (const o of ordersToday) {
      if (o.paymentMethod === "CASH") realCash += o.total;
      else if (o.paymentMethod === "CARD") realCard += o.total;
      else if (o.paymentMethod === "TRANSFER") realTransfer += o.total;
    }
    const realTotalSales = realCash + realCard + realTransfer;
    const expectedBalance = register.openingBalance + realTotalSales - register.totalExpenses;

    // Detectar discrepancia vs lo que la caja registró en memoria
    const discrepancy = Math.round((register.totalSales - realTotalSales) * 100) / 100;
    const hasDiscrepancy = Math.abs(discrepancy) > 0.01;

    const closingBalance = req.body.closingBalance !== undefined ? req.body.closingBalance : expectedBalance;
    const closingDiscrepancy = Math.round((closingBalance - expectedBalance) * 100) / 100;
    const hasClosingDiscrepancy = Math.abs(closingDiscrepancy) > 0.01;

    const closed = await crPrisma.cashRegister.update({
      where: { id: register.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingBalance,
        expectedBalance,
        totalSales: realTotalSales,
        totalCash: realCash,
        totalCard: realCard,
        totalTransfer: realTransfer,
        notes: req.body.notes ?
          `${req.body.notes}${hasDiscrepancy ? ` | ⚠️ Discrepancia: la caja reportó $${discrepancy.toFixed(2)} más de lo facturado` : ""}${hasClosingDiscrepancy ? ` | ⚠️ Cierre difiere $${closingDiscrepancy.toFixed(2)} del esperado` : ""}`
          : `${hasDiscrepancy ? `⚠️ Discrepancia: caja reportó $${discrepancy.toFixed(2)} más de lo facturado` : "✅ Sin discrepancia"}${hasClosingDiscrepancy ? ` | ⚠️ Cierre difiere $${closingDiscrepancy.toFixed(2)} del esperado` : ""}`,
      },
    });

    res.json({
      register: closed,
      verification: {
        openingBalance: register.openingBalance,
        realSales: realTotalSales,
        expectedBalance,
        closingBalance,
        discrepancy: hasDiscrepancy ? discrepancy : 0,
        closingDiscrepancy: hasClosingDiscrepancy ? closingDiscrepancy : 0,
        breakdown: { cash: realCash, card: realCard, transfer: realTransfer },
      },
    });
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

// GET /api/cash-register/history
crRouter.get("/history", crAuthz("CASHIER", "ADMIN"), async (req: CRReq, res: CRRes) => {
  try {
    const registers = await crPrisma.cashRegister.findMany({
      where: { restaurantId: req.restaurantId!, status: "CLOSED" },
      include: { cashier: { select: { name: true } } },
      orderBy: { closedAt: "desc" },
      take: 30,
    });
    res.json({ registers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

export { crRouter as default };



