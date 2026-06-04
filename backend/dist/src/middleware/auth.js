"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
exports.authenticate = authenticate;
exports.authorize = authorize;
exports.signToken = signToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está configurado. Define una variable de entorno aleatoria (≥32 bytes) antes de arrancar.");
}
const JWT_SECRET = process.env.JWT_SECRET;
exports.JWT_SECRET = JWT_SECRET;
/** Extract and verify JWT from Authorization header */
async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Token requerido" });
        return;
    }
    const token = header.slice(7);
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        res.status(401).json({ error: "Token inválido o expirado" });
        return;
    }
    // S5 — revocación: el tokenVersion del JWT debe coincidir con el de la BD.
    // Al cambiar contraseña se incrementa tokenVersion → los JWT viejos quedan inválidos.
    try {
        const user = await index_1.prisma.user.findUnique({
            where: { id: payload.userId },
            select: { tokenVersion: true, active: true },
        });
        if (!user || !user.active || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
            res.status(401).json({ error: "Sesión expirada. Inicia sesión de nuevo." });
            return;
        }
    }
    catch {
        res.status(500).json({ error: "Error de autenticación" });
        return;
    }
    req.user = payload;
    next();
}
/** Factory: restrict route to specific roles */
function authorize(...allowedRoles) {
    return (req, res, next) => {
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
function signToken(payload, expiresIn = "12h") {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: expiresIn });
}
//# sourceMappingURL=auth.js.map