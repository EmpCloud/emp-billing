import { defineConfig } from "vitest/config";
import { resolve } from "path";
import dotenv from "dotenv";

// Load .env from project root so DB_PASSWORD and other secrets are available
dotenv.config({ path: resolve(__dirname, "../../.env") });

export default defineConfig({
  resolve: {
    alias: {
      "@emp-billing/shared": resolve(__dirname, "../shared/src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    pool: "forks",
    include: ["src/**/*.test.ts", "src/__tests__/**/*.test.ts"],
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      all: true,
      reportOnFailure: true,
      include: ["src/services/**/*.ts", "src/utils/**/*.ts", "src/api/middleware/**/*.ts"],
      exclude: ["src/__tests__/**", "**/IPaymentGateway.ts", "**/IDBAdapter.ts", "tests/**", "src/db/migrations/**", "src/db/seeds/**"],
      reporter: ["text", "text-summary", "json"],
      reportsDirectory: "./coverage",
    },
  },
});
