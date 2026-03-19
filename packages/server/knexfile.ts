import type { Knex } from "knex";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const provider = process.env.DB_PROVIDER || "mysql";
const client = provider === "pg" ? "pg" : "mysql2";
const port = provider === "pg" ? 5432 : parseInt(process.env.DB_PORT || "3306");

const config: Knex.Config = {
  client,
  connection: {
    host: process.env.DB_HOST || "localhost",
    port,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "emp_billing",
    ...(client === "mysql2" ? { timezone: "+00:00", charset: "utf8mb4" } : {}),
  },
  migrations: {
    directory: "./src/db/migrations",
    extension: "ts",
  },
  seeds: {
    directory: "./src/db/seeds",
    extension: "ts",
  },
};

export default config;
