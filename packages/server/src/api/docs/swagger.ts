import type { Express } from "express";
import { openApiSpec } from "./openapi";
import { logger } from "../../utils/logger";

/**
 * Mount Swagger UI at /api/docs for interactive API documentation.
 *
 * Uses swagger-ui-express to serve a browsable OpenAPI 3.0 spec
 * generated from the openapi.ts file in this directory.
 *
 * Usage in the main server entry point:
 *
 *   import { setupSwagger } from "./api/docs/swagger";
 *   setupSwagger(app);
 */
export function setupSwagger(app: Express): void {
  try {
    // Dynamic import so swagger-ui-express is an optional dependency.
    // If it is not installed the docs endpoint simply won't be mounted.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const swaggerUi = require("swagger-ui-express");

    const options = {
      customSiteTitle: "EMP Billing API Docs",
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { font-size: 2rem; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
    };

    app.use(
      "/api/docs",
      swaggerUi.serve,
      swaggerUi.setup(openApiSpec, options),
    );

    // Also expose the raw JSON spec for programmatic consumers
    app.get("/api/docs.json", (_req, res) => {
      res.json(openApiSpec);
    });

    logger.info("Swagger UI mounted at /api/docs");
  } catch {
    logger.warn(
      "swagger-ui-express is not installed — skipping Swagger UI. " +
        'Run "npm install swagger-ui-express" to enable /api/docs.',
    );
  }
}
