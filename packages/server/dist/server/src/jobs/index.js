"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkers = startWorkers;
const logger_1 = require("../utils/logger");
const queue_1 = require("./queue");
require("./email.worker");
require("./recurring.worker");
require("./reminder.worker");
require("./pdf.worker");
require("./scheduled-report.worker");
require("./dunning.worker");
require("./subscription.worker");
require("./usage-billing.worker");
// ============================================================================
// WORKER BOOTSTRAP
// Call startWorkers() once during server startup.
// ============================================================================
async function startWorkers() {
    try {
        await (0, queue_1.scheduleRecurringJobs)();
        await (0, queue_1.scheduleReminderJobs)();
        await (0, queue_1.scheduleScheduledReportJobs)();
        await (0, queue_1.scheduleDunningJobs)();
        await (0, queue_1.scheduleSubscriptionJobs)();
        await (0, queue_1.scheduleUsageBillingJobs)();
        logger_1.logger.info("All BullMQ workers started");
    }
    catch (err) {
        logger_1.logger.warn("BullMQ workers not started (Redis may be unavailable)", { err });
    }
}
//# sourceMappingURL=index.js.map