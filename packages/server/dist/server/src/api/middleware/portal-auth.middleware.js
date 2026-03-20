"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalAuth = portalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../../config/index");
const AppError_1 = require("../../utils/AppError");
function portalAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        throw (0, AppError_1.UnauthorizedError)("Missing or malformed Authorization header");
    }
    const token = authHeader.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, index_1.config.jwt.accessSecret);
        // Ensure this is a portal token, not a regular user token
        if (payload.type !== "portal") {
            throw (0, AppError_1.UnauthorizedError)("Invalid portal token");
        }
        req.portalClient = {
            clientId: payload.sub,
            orgId: payload.orgId,
        };
        next();
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.JsonWebTokenError || err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw (0, AppError_1.UnauthorizedError)("Invalid or expired portal token");
        }
        throw err;
    }
}
//# sourceMappingURL=portal-auth.middleware.js.map