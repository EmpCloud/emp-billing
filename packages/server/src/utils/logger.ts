import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { config } from "../config/index";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

const productionTransports: winston.transport[] = [
  new DailyRotateFile({
    filename: "logs/%DATE%-combined.log",
    datePattern: "YYYY-MM-DD",
    maxSize: "50m",
    maxFiles: "30d",
    level: "info",
  }),
  new DailyRotateFile({
    filename: "logs/%DATE%-error.log",
    datePattern: "YYYY-MM-DD",
    maxSize: "50m",
    maxFiles: "30d",
    level: "error",
  }),
];

export const logger = winston.createLogger({
  level: config.env === "production" ? "info" : "debug",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    config.env === "production" ? winston.format.json() : combine(colorize(), logFormat)
  ),
  transports: [
    new winston.transports.Console(),
    ...(config.env === "production" ? productionTransports : []),
  ],
});
