"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function required(key) {
    const val = process.env[key];
    if (!val)
        throw new Error(`Missing required env var: ${key}`);
    return val;
}
function optional(key, fallback) {
    return process.env[key] || fallback;
}
exports.config = {
    env: optional("NODE_ENV", "development"),
    port: parseInt(optional("PORT", "4001")),
    // CORS
    corsOrigin: optional("CORS_ORIGIN", "http://localhost:5174"),
    // JWT
    jwt: {
        accessSecret: optional("JWT_ACCESS_SECRET", "emp-billing-access-secret-change-in-prod"),
        refreshSecret: optional("JWT_REFRESH_SECRET", "emp-billing-refresh-secret-change-in-prod"),
        accessExpiresIn: optional("JWT_ACCESS_EXPIRES_IN", "15m"),
        refreshExpiresIn: optional("JWT_REFRESH_EXPIRES_IN", "7d"),
    },
    // Database
    db: {
        provider: optional("DB_PROVIDER", "mysql"),
        host: optional("DB_HOST", "localhost"),
        port: parseInt(optional("DB_PORT", "3306")),
        user: optional("DB_USER", "root"),
        password: optional("DB_PASSWORD", ""),
        name: optional("DB_NAME", "emp_billing"),
        poolMin: parseInt(optional("DB_POOL_MIN", "2")),
        poolMax: parseInt(optional("DB_POOL_MAX", "10")),
    },
    // Redis
    redis: {
        host: optional("REDIS_HOST", "localhost"),
        port: parseInt(optional("REDIS_PORT", "6379")),
        password: optional("REDIS_PASSWORD", ""),
    },
    // Email
    smtp: {
        host: optional("SMTP_HOST", "smtp.mailtrap.io"),
        port: parseInt(optional("SMTP_PORT", "587")),
        user: optional("SMTP_USER", ""),
        password: optional("SMTP_PASSWORD", ""),
        from: optional("SMTP_FROM", "billing@empcloud.io"),
        fromName: optional("SMTP_FROM_NAME", "EMP Billing"),
    },
    // File storage
    upload: {
        maxFileSizeMb: parseInt(optional("MAX_FILE_SIZE_MB", "10")),
        uploadDir: optional("UPLOAD_DIR", "./uploads"),
    },
    // Payment Gateways
    gateways: {
        stripe: {
            secretKey: optional("STRIPE_SECRET_KEY", ""),
            webhookSecret: optional("STRIPE_WEBHOOK_SECRET", ""),
        },
        razorpay: {
            keyId: optional("RAZORPAY_KEY_ID", ""),
            keySecret: optional("RAZORPAY_KEY_SECRET", ""),
            webhookSecret: optional("RAZORPAY_WEBHOOK_SECRET", ""),
        },
        paypal: {
            clientId: optional("PAYPAL_CLIENT_ID", ""),
            clientSecret: optional("PAYPAL_CLIENT_SECRET", ""),
            webhookId: optional("PAYPAL_WEBHOOK_ID", ""),
            sandbox: optional("PAYPAL_SANDBOX", "true") === "true",
        },
    },
    // SMS (Twilio)
    sms: {
        twilioAccountSid: optional("TWILIO_ACCOUNT_SID", ""),
        twilioAuthToken: optional("TWILIO_AUTH_TOKEN", ""),
        twilioFromNumber: optional("TWILIO_FROM_NUMBER", ""),
    },
    // WhatsApp
    whatsapp: {
        provider: optional("WHATSAPP_PROVIDER", "twilio"),
        // Twilio WhatsApp (can reuse SMS credentials if not set)
        twilioAccountSid: optional("WHATSAPP_TWILIO_ACCOUNT_SID", ""),
        twilioAuthToken: optional("WHATSAPP_TWILIO_AUTH_TOKEN", ""),
        twilioFromNumber: optional("WHATSAPP_TWILIO_FROM_NUMBER", ""),
        twilioContentSids: (() => {
            const raw = optional("WHATSAPP_TWILIO_CONTENT_SIDS", "");
            if (!raw)
                return {};
            try {
                return JSON.parse(raw);
            }
            catch {
                return {};
            }
        })(),
        // Meta Cloud API
        metaPhoneNumberId: optional("WHATSAPP_META_PHONE_NUMBER_ID", ""),
        metaAccessToken: optional("WHATSAPP_META_ACCESS_TOKEN", ""),
        metaApiVersion: optional("WHATSAPP_META_API_VERSION", "v18.0"),
    },
    // Bcrypt
    bcryptRounds: parseInt(optional("BCRYPT_ROUNDS", "12")),
    // Rate limiting
    rateLimit: {
        windowMs: parseInt(optional("RATE_LIMIT_WINDOW_MS", "900000")), // 15 min
        max: parseInt(optional("RATE_LIMIT_MAX", "100")),
    },
};
//# sourceMappingURL=index.js.map