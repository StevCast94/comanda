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
const JWT_SECRET = process.env.JWT_SECRET || "comanda-dev-secret-change-in-prod";
exports.JWT_SECRET = JWT_SECRET;
/** Extract and verify JWT from Authorization header */
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Token requerido" });
        return;
    }
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ error: "Token inválido o expirado" });
    }
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