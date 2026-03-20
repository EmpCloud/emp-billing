"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
exports.validateParams = validateParams;
// Validate req.body against a Zod schema — throws ZodError on failure
// which is caught by errorMiddleware and returns a 422 response.
function validateBody(schema) {
    return (req, _res, next) => {
        req.body = schema.parse(req.body);
        next();
    };
}
// Validate req.query
function validateQuery(schema) {
    return (req, _res, next) => {
        req.query = schema.parse(req.query);
        next();
    };
}
// Validate req.params
function validateParams(schema) {
    return (req, _res, next) => {
        req.params = schema.parse(req.params);
        next();
    };
}
//# sourceMappingURL=validate.middleware.js.map