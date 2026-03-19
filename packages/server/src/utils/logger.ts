import winston from "winston";
import { config } from "../config/index";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: config.env === "production" ? "info" : "debug",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    config.env === "production" ? winston.format.json() : combine(colorize(), logFormat)
  ),
  transports: [
    new winston.transports.Console(),
    ...(config.env === "production"
      ? [
          new winston.transports.File({ filename: "logs/error.log", level: "error" }),
          new winston.transports.File({ filename: "logs/combined.log" }),
        ]
      : []),
  ],
});
