"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = setupSwagger;
const openapi_1 = require("./openapi");
const logger_1 = require("../../utils/logger");
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
function setupSwagger(app) {
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
        app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi_1.openApiSpec, options));
        // Also expose the raw JSON spec for programmatic consumers
        app.get("/api/docs.json", (_req, res) => {
            res.json(openapi_1.openApiSpec);
        });
        logger_1.logger.info("Swagger UI mounted at /api/docs");
    }
    catch {
        logger_1.logger.warn("swagger-ui-express is not installed — skipping Swagger UI. " +
            'Run "npm install swagger-ui-express" to enable /api/docs.');
    }
}
//# sourceMappingURL=swagger.js.map