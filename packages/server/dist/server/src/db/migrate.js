"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./adapters/index");
const logger_1 = require("../utils/logger");
async function main() {
    const db = await (0, index_1.getDB)();
    try {
        await db.migrate();
        logger_1.logger.info("Migration complete");
    }
    finally {
        await (0, index_1.closeDB)();
    }
}
main().catch((err) => {
    logger_1.logger.error("Migration failed", { err });
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map