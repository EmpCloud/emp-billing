import type { Express } from "express";
import { openApiSpec } from "./openapi";
import { logger } from "../../utils/logger";

/**
 * Mount Swagger UI at /api/docs for interactive API documentation.
 *
 * Uses swagger-ui-express to serve a browsable OpenAPI 3.0 spec
 * generated from the openapi.ts file in this directory.
 *
 * Features:
 * - Custom title: "EMP Billing API"
 * - Getting started guide in the description
 * - Endpoints grouped by tags
 * - Authorize button for both JWT and API key auth
 * - Persistent authorization across page reloads
 * - Code samples (x-codeSamples) for key endpoints
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
      customSiteTitle: "EMP Billing API",
      customfavIcon: "",
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { font-size: 2rem; font-weight: 700; }
        .swagger-ui .info .description h1 { font-size: 1.5rem; margin-top: 1rem; }
        .swagger-ui .info .description h2 { font-size: 1.2rem; margin-top: 0.8rem; color: #333; }
        .swagger-ui .info .description code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
        .swagger-ui .info .description ul { margin-left: 1.5rem; }
        .swagger-ui .scheme-container { background: #fafafa; padding: 1rem; border-radius: 4px; }
        .swagger-ui .opblock-tag { font-size: 1.1rem; }
        .swagger-ui .opblock-summary-description { font-size: 0.9rem; }
        .swagger-ui .btn.authorize {
          background-color: #4F46E5;
          color: white;
          border-color: #4F46E5;
          font-weight: 600;
        }
        .swagger-ui .btn.authorize:hover { background-color: #4338CA; }
        .swagger-ui .btn.authorize svg { fill: white; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        docExpansion: "list" as const,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        tagsSorter: "alpha" as const,
        operationsSorter: "method" as const,
        showExtensions: true,
        showCommonExtensions: true,
        requestSnippetsEnabled: true,
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
